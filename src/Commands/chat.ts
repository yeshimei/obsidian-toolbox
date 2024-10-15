import { Notice, TFile } from 'obsidian';
import OpenAI from 'openai';
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

export type MESSAGE_TYEP = {
  content: string;
  role: 'user' | 'system' | 'assistant';
  name?: string;
  prefix?: string;
  type?: string;
};

const defaultOpenAioptions = {
  frequency_penalty: 0,
  presence_penalty: 0,
  temperature: 1,
  top_p: 1,
  action: 'default',
  save: true
};

export default class Chat {
  data: REQUEST_BODY = { ...defaultOpenAioptions };
  self: Toolbox;
  title = '';
  messages: MESSAGE_TYEP[] = [];
  promptName: string;
  promptContent: string;
  saveChatFile: TFile;
  isStopped = true;
  constructor(self: Toolbox) {
    this.self = self;
  }

  async getTitle(updateText: (text: string) => void) {
    await this.openChat({ role: 'user', content: inPrompts['namingTitle'].promptContent, type: 'title' }, async text => {
      updateText(text);
      this.title += text;
    });

    this.messages = this.messages.filter(res => res.type !== 'title');
  }

  /**
   * 指定 prompt，根据给定名称从文件系统中读取提示内容及其相关参数
   * @param name - 要指定的 prompt 名称
   */
  async specifyPrompt(name: string): Promise<void> {
    const path = this.self.settings.chatPromptFolder + '/' + name + '.md';
    const file = this.self.app.vault.getFileByPath(path);
    if (!file) {
      this.data = { ...defaultOpenAioptions };
      return;
    }

    this.promptName = name;
    this.promptContent = (await this.self.app.vault.cachedRead(file)).replace(/---[\s\S]*?---/, '');
    const frontmatter = this.self.app.metadataCache.getFileCache(file)?.frontmatter || {};
    this.data.frequency_penalty = Number(frontmatter.frequency_penalty || defaultOpenAioptions.frequency_penalty);
    this.data.presence_penalty = Number(frontmatter.presence_penalty || defaultOpenAioptions.presence_penalty);
    this.data.temperature = Number(frontmatter.temperature || defaultOpenAioptions.temperature);
    this.data.max_tokens = frontmatter.max_tokens ? Number(frontmatter.max_tokens) : null;
    this.data.top_p = Number(frontmatter.top_p || defaultOpenAioptions.top_p);
    this.data.action = frontmatter.action || defaultOpenAioptions.action;
    this.data.save = frontmatter.save === 'false' || frontmatter.save === '0' ? false : true || defaultOpenAioptions.save;
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
    const sanitizedTitle = this.title.replace(/[\\\/<>\:\|\?]/g, '');
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
   * @returns {Promise<MESSAGE_TYEP[]>} 返回聊天记录
   */
  async loadHistoryChat(path: string): Promise<MESSAGE_TYEP[]> {
    const file = this.self.app.vault.getFileByPath(path);
    if (file) {
      const content = await this.self.app.vault.cachedRead(file);
      const messages: MESSAGE_TYEP[] = [];
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
   * @param messgae - 需要发送的消息
   * @param updateText - 更新聊天内容的回调函数。
   * @returns Promise<void>
   */
  async openChat(messgae: MESSAGE_TYEP[] | MESSAGE_TYEP | string, updateText: (text: string, type: string) => void): Promise<void> {
    if (!messgae) return;
    this.isStopped = false;
    const { chatKey, chatUrl, chatModel } = this.self.settings;

    this.promptContent && this.messages.push({ role: 'system', content: this.promptContent, type: 'prompt' });
    this.promptContent = null;

    if (typeof messgae === 'string') {
      messgae = [{ content: messgae, role: 'user', type: 'question' }];
    } else if (!Array.isArray(messgae)) {
      messgae = [messgae];
    }

    // 仅保留最后一个问题
    let messages = this.messages.filter(res => res.type !== 'question');

    const type = messgae[0].type;

    this.messages = this.messages.concat(messgae);
    messages = messages.concat(messgae);
    const answer: MESSAGE_TYEP = { role: 'system', content: '', type: type === 'question' ? 'answer' : type };
    this.messages.push(answer);
    messages.push(answer);

    const openai = new OpenAI({
      baseURL: chatUrl,
      apiKey: chatKey,
      dangerouslyAllowBrowser: true
    });

    try {
      const completion = await openai.chat.completions.create({
        messages,
        model: chatModel,
        stream: true,
        ...this.data
      });

      for await (const chunk of completion) {
        if (this.isStopped) {
          updateText('', 'content');
          break;
        }

        const choices = chunk.choices as any;
        const text = choices[0].delta.content;
        const finish = (this.isStopped = choices[0].finish_reason);
        if (text || finish) {
          updateText(text, 'content');
          answer.content += text;
        }

        if (finish && !this.title) {
          this.getTitle(text => {
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
