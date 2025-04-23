import { Notice, TFile } from 'obsidian';
import OpenAI from 'openai';
import { sanitizeFileName } from 'src/helpers';
import Toolbox from 'src/main';
import inPrompts from './AIChatInPrompt';

export type REQUEST_BODY = {
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  action?: string;
  save?: boolean;
};

export type MESSAGE_TYPE = {
  content: string;
  role: 'user' | 'system' | 'assistant';
  name?: string;
  prefix?: string;
  type?: string;
  files?: string[];
};

const defaultOpenAiOptions = {
  frequency_penalty: 0,
  presence_penalty: 0,
  temperature: 1,
  top_p: 1,
  action: 'default',
  save: true
};

export default class AIChatManager {
  data: REQUEST_BODY = { ...defaultOpenAiOptions };
  self: Toolbox;
  title = '';
  messages: MESSAGE_TYPE[] = [];
  promptName: string;
  promptContent: string;
  saveChatFile: TFile;
  model: string;
  isStopped = true;
  constructor(self: Toolbox) {
    this.self = self;
  }

  async getTitle(updateText: (text: string) => void) {
    const chat = new AIChatManager(this.self);
    chat.data.save = false
    await chat.openChat([
      { role: 'system', content: inPrompts['namingTitle'].promptContent, type: 'prompt' },
      { role: 'user', content: this.messages.slice(-1)[0].content, type: 'content'}
    ], async text => {
      updateText(text);
      this.title += text;
      chat.title += text;
    });
  }

  /**
   * 指定 prompt，根据给定名称从文件系统中读取提示内容及其相关参数
   * @param name - 要指定的 prompt 名称
   */
  async specifyPrompt(name: string): Promise<void> {
    const path = this.self.settings.chatPromptFolder + '/' + name + '.md';
    const file = this.self.app.vault.getFiles().find(f => f.path === path);
    if (!file) {
      this.data = { ...defaultOpenAiOptions };
      return;
    }

    this.promptName = name;
    this.promptContent = (await this.self.app.vault.cachedRead(file)).replace(/---[\s\S]*?---/, '');
    const frontmatter = this.self.app.metadataCache.getFileCache(file)?.frontmatter || {};
    this.data.frequency_penalty = Number(frontmatter.frequency_penalty || defaultOpenAiOptions.frequency_penalty);
    this.data.presence_penalty = Number(frontmatter.presence_penalty || defaultOpenAiOptions.presence_penalty);
    this.data.temperature = Number(frontmatter.temperature || defaultOpenAiOptions.temperature);
    this.data.max_tokens = frontmatter.max_tokens ? Number(frontmatter.max_tokens) : null;
    this.data.top_p = Number(frontmatter.top_p || defaultOpenAiOptions.top_p);
    this.data.action = frontmatter.action || defaultOpenAiOptions.action;
    this.data.save = frontmatter.save === 'false' || frontmatter.save === '0' ? false : true || defaultOpenAiOptions.save;
  }

  /**
   * 保存聊天记录
   * 该方法将当前聊天记录中的消息格式化为文本，并保存为Markdown文件。
   * @returns {Promise<TFile>} 返回保存的文件路径
   */
  async saveChat(): Promise<TFile> {
    const text = this.messages.reduce((ret, res, i, arr) => {
      if (res.type === 'question') ret += res.content.trim().replace(/^</, '') + '\n\n';
      else if (res.type === 'answer') ret += '> ' + res.content.replace(/\n/gm, '\n> ') + '\n\n';
      else if (res.type === 'file') ret += `[[${res.content.split('\n')[0]}]]${arr[i + 1].type === 'file' ? '\n' : '\n\n'}`;
      return ret;
    }, '');
    const sanitizedTitle = sanitizeFileName(this.title);
    if (this.saveChatFile) {
      await this.self.app.vault.modify(this.saveChatFile, text);
    } else {
      const path = this.self.settings.chatSaveFolder + '/' + sanitizedTitle + ' - ' + Date.now() + '.md';
      this.saveChatFile = await this.self.app.vault.create(path, text);
    }

    return this.saveChatFile;
  }

  /**
   * 加载历史聊天记录
   * @param path - 聊天记录文件的路径
   * @returns {Promise<MESSAGE_TYPE[]>} 返回聊天记录
   */
  async loadHistoryChat(path: string): Promise<MESSAGE_TYPE[]> {
    const file = this.self.app.vault.getFiles().find(f => f.path === path);
    if (file) {
      const content = await this.self.app.vault.cachedRead(file);
      const messages: MESSAGE_TYPE[] = [];
      const items = content.split('\n\n').filter(Boolean);

      for (let item of items) {
        if (item.startsWith('> ')) {
          messages.push({ role: 'system', content: item.replace(/^> /gm, ''), type: 'answer' });
        } else {
          messages.push({ role: 'user', content: item, type: 'question' });
          continue;
        }

        const path = item.match(/\[\[(.+?\.md)\]\]/g);
        if (path) {
          for (let p of path) {
            p = p.slice(1, -2);
            messages.push({ role: 'user', content: `${p}\n${await this.self.app.vault.adapter.read(p)}`, type: 'file' });
          }
        }
      }

      this.messages = messages;
      this.saveChatFile = file;
      this.title = file.basename.split(' - ')[0];
      return messages;
    }
  }

  /**
   * 内容自动补全
   * @param prefix - 输入文本前缀
   * @param suffix - 输入文本后缀
   * @param maxLength -  token 最大长度
   * @param updateText - 更新文本的回调函数
   */
  async FIMCompletion(prefix: string, suffix: string, maxLength: number, updateText: (text: string) => void): Promise<void> {
    if (!prefix) return;
    const { chatKey, chatUrl, chatModel } = this.self.settings;
    const openai = new OpenAI({
      baseURL: chatUrl,
      apiKey: chatKey,
      dangerouslyAllowBrowser: true
    });

    try {
      const completion = await openai.completions.create({
        model: chatModel,
        prompt: prefix,
        suffix: suffix,
        max_tokens: maxLength,
        ...this.data
      });

      const text = completion.choices[0].text;
      updateText(text);
    } catch (error) {
      new Notice(error.message);
    }
  }

  clearMessage() {
    this.messages = [];
  }

  /**
   * 停止聊天
   * 将 isStopped 标志设置为 true，表示聊天已停止
   */
  async stopChat() {
    this.isStopped = true;
  }

  /**
   * 开启聊天
   *
   * @param message - 需要发送的消息
   * @param updateText - 更新聊天内容的回调函数。
   * @returns Promise<void>
   */
  async openChat(message: MESSAGE_TYPE[] | MESSAGE_TYPE | string, updateText: (text: string, type: string, reasoning_content?: string) => void): Promise<void> {
    if (!message) return;
    this.isStopped = false;
    let { chatKey, chatUrl, chatModel } = this.self.settings;
    if (this.model) chatModel = this.model

    if (this.promptContent && this.messages.length === 0) {
      this.messages.push({ role: 'system', content: this.promptContent, type: 'prompt' });
    }

    if (typeof message === 'string') {
      this.messages.push({  role: 'user', content: message, type: 'question' });
    } else if (Array.isArray(message)) {
      this.messages.push(...message);
    } else {
      this.messages.push(message);
    }
    const answer: MESSAGE_TYPE = { role: 'assistant', content: '', type: 'answer' };
    const openai = new OpenAI({
      baseURL: chatUrl,
      apiKey: chatKey,
      dangerouslyAllowBrowser: true
    });
    try {
      const completion = await openai.chat.completions.create({
        messages: this.messages,
        model: chatModel,
        stream: true,
        ...this.data
      });

      for await (const chunk of completion) {
        if (this.isStopped) {
          updateText('', 'stop');
          break;
        }
 
        const choices = chunk.choices as any;
        const content = choices[0].delta.content
        const reasoning_content = choices[0].delta.reasoning_content
        const finish = (this.isStopped = choices[0].finish_reason);
        updateText(reasoning_content || content || '', content === null ? 'reasoning_content' :'content');
        answer.content += (content || '');
        if (finish) {
          this.messages.push(answer);
          updateText('', 'stop');
        }

        if (finish && !this.title) {
          
          await this.getTitle(text => {
            updateText(text, 'title');
          });
        }
      }
    } catch (error) {
      new Notice(error.message);
    }

    this.data.save && this.isStopped && this.title && (await this.saveChat());
  }
}
