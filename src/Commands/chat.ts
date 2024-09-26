import { ButtonComponent, MarkdownView, Modal, Notice, Setting, TextAreaComponent, TFile } from 'obsidian';
import OpenAI from 'openai';
import { createChatArea, formatFileSize, getBooksList, getOptionList } from 'src/helpers';
import Toolbox from 'src/main';
import FuzzySuggest from 'src/Modals/FuzzySuggest';

export default function chatCommand(self: Toolbox) {
  self.settings.chat &&
    self.addCommand({
      id: 'AI Chat',
      name: 'AI Chat',
      icon: 'bot',
      callback: () => chat(self, null)
    });
}

export async function chat(self: Toolbox, text: string) {
  if (!self.settings.chat) return;
  if (!text) {
    const editor = self.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    if (editor) text = editor.getSelection();
  }
  new PanelChat(self, text).open();
}

class PanelChat extends Modal {
  chat: Chat;
  self: Toolbox;
  files: Set<TFile> = new Set();
  chatArea: HTMLDivElement;
  fileArea: HTMLDivElement;
  promptName = 'AI Chat';
  action = 'deafult';
  question = '';
  sendBtn: ButtonComponent;
  AttacBtn: ButtonComponent;
  saveBtn: ButtonComponent;
  actionBtn: ButtonComponent;
  textArea: TextAreaComponent;
  constructor(self: Toolbox, content: string) {
    super(self.app);
    this.self = self;
    this.chat = new Chat(self);
    this.question = content;
  }

  onOpen() {
    let defaultTextAreaHeight = '';
    const { contentEl } = this;
    this.setTitle('AI Chat');
    contentEl.appendChild((this.chatArea = createChatArea()));
    contentEl.appendChild((this.fileArea = createChatArea()));
    contentEl.onclick = evt => {
      const target = evt.target as HTMLElement;
      if (target.classList.contains('__remove')) {
        const { path } = target.dataset;
        const fileToRemove = Array.from(this.files).find((file: TFile) => file.path === path);
        if (fileToRemove) {
          const size = this.files.size;
          this.files.delete(fileToRemove);
          (target.parentNode as HTMLElement).remove();
          size ? this.AttacBtn.setCta() : this.AttacBtn.removeCta();
          this.sendBtn.setDisabled(!size);
        }
      }
    };

    new Setting(contentEl)
      .addTextArea(text => {
        this.textArea = text;
        text.inputEl.style.width = '100%';
        defaultTextAreaHeight = text.inputEl.style.height;
        text.inputEl.style.height = text.inputEl.scrollHeight + 'px';

        text.setValue(this.question).onChange(value => {
          this.sendBtn.setDisabled(!value);
          this.question = value;
          text.inputEl.style.height = text.inputEl.scrollHeight + 'px';
        });
      })
      // 发送
      .addButton(btn => {
        this.sendBtn = btn;
        btn.buttonEl.style.marginTop = 'auto';
        btn.buttonEl.style.width = '3rem';
        btn
          .setIcon('send')
          .setDisabled(!this.question)
          .setCta()
          .onClick(async () => {
            this.textArea.inputEl.style.height = defaultTextAreaHeight;
            await this.startChat();
          });
      }).infoEl.style.display = 'none';

    new Setting(contentEl)
      // 选择一个 prompt
      .addDropdown(cd => {
        cd.addOption('', '选择 prompt');
        getOptionList(this.self.app, this.self.settings.chatPromptFolder).forEach((prompt: any) => {
          cd.addOption(prompt.value, prompt.name);
        });
        cd.setValue('');
        cd.onChange(async (value: any) => {
          this.promptName = value || 'AI Chat';
          await this.chat.specifyPrompt(value);
          const action = actions.find(a => a.text.name === this.chat.data.action) || actions[0];
          this.action = action.text.name;
          this.actionBtn.setIcon(action.text.icon);
          this.action === 'default' ? this.actionBtn.removeCta() : this.actionBtn.setCta();
        });
      })
      // 选择一篇笔记作为附件
      .addButton(btn => {
        this.AttacBtn = btn;
        btn.buttonEl.style.width = '3rem';
        const paths = getBooksList(this.self.app).map(({ text }) => ({
          value: text.path + ' - ' + formatFileSize(text.stat.size),
          text: text
        }));
        const currentFile = this.self.app.workspace.getActiveFile();
        if (currentFile) {
          paths.unshift({
            text: currentFile,
            value: currentFile.path + ' - ' + formatFileSize(currentFile.stat.size)
          });
        }
        btn.setIcon('paperclip').onClick(() => {
          new FuzzySuggest(this.app, paths, async ({ text }) => {
            if (text) {
              const fileSize = formatFileSize(text.stat.size);
              const size = this.files.size;
              this.files.add(text);
              const newSize = this.files.size;
              newSize ? btn.setCta() : btn.removeCta();
              this.sendBtn.setDisabled(!newSize);
              let color = 'unset';
              if (text.stat.size > 1024 * 1024) {
                // 大于1M
                color = '#FF4500'; // 危险色
              } else if (text.stat.size > 1024 * 100) {
                // 大于100K
                color = '#FFA500'; // 警告色
              }
              newSize > size && (this.fileArea.innerHTML += `<div>📄 ${text.path} - <span style="color: ${color};">${fileSize}</span> <span style="cursor: pointer;" class="__remove" data-path="${text.path}">🔥</span><br></div>`);
            }
          }).open();
        });
      })

      // 打开历史对话
      .addButton(btn => {
        this.saveBtn = btn;
        btn.buttonEl.style.width = '3rem';
        const paths = getBooksList(this.self.app, this.self.settings.chatSaveFolder).map(({ text }) => ({
          value: text.basename.split(' - ').shift(),
          text: text
        }));
        btn.setIcon('gallery-horizontal-end').onClick(() => {
          new FuzzySuggest(this.app, paths, async ({ text }) => {
            this.loadHistoryChat(text.path);
            btn.setCta();
          }).open();
        });
      })
      // 选择一个 Action
      .addButton(btn => {
        this.actionBtn = btn;
        btn.buttonEl.style.width = '3rem';
        btn.setIcon(actions[0].text.icon).onClick(() => {
          new FuzzySuggest(this.app, actions, async ({ text }) => {
            btn.setIcon(text.icon);
            this.action = text.name;
            text.name === 'default' ? btn.removeCta() : btn.setCta();
          }).open();
        });
      });
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
    switch (this.action) {
      case 'replace':
        actionReplace(this.self, this.chat);
        break;
      case 'wikiLink':
        actionWikiLink(this.self, this.chat);
        break;
      case 'notSaveChat':
        actionnotSaveChat(this.self, this.chat);
    }
  }

  async startChat() {
    if (!this.chat.isStopped) {
      this.chat.stopChat();
      return;
    }
    let question = this.question || '';
    let list = '';
    const meesages: MESSAGE_TYEP[] = [{ role: 'user', content: question, type: 'question' }];
    this.textArea.setValue('');
    for (let file of this.files) {
      const content = `${file.path}\n${await this.self.app.vault.cachedRead(file)}`;
      meesages.push({ role: 'user', content, type: 'file' });
      list += `📄 ${file.path}\n`;
    }
    this.chatArea.innerHTML += `<hr>${list}<br><br><b><i>叫我包仔：</i></b>\n${this.question}\n\n<b><i>${this.promptName}：</i></b>\n`;
    this.question = '';

    this.sendBtn.setIcon('circle-slash');
    await this.chat.openChat(meesages, (text, type) => {
      this.files.clear();
      this.fileArea.innerHTML = '';
      if (type === 'content') {
        this.chatArea.innerHTML += text;
        setTimeout(() => this.chatArea.scrollTo(0, this.chatArea.scrollHeight), 0);
      } else if (type === 'title') {
        this.setTitle(this.chat.title);
      }

      if (!text) {
        this.sendBtn.setIcon('send');
        this.sendBtn.setDisabled(!this.question);
      }
    });
  }

  async loadHistoryChat(path: string) {
    const messages = await this.chat.loadHistoryChat(path);
    this.setTitle(this.chat.title);
    this.chatArea.innerHTML = messages.reduce((ret, res, i, arr) => {
      if (res.type === 'question') ret += `<hr><b><i>叫我包仔：</i></b>\n${res.content}\n\n`;
      else if (res.type === 'answer') ret += `<b><i>AI Cha：</i></b>\n${res.content}`;
      else if (res.type === 'file') ret += `📄 ${res.content.split('\n')[0]}${arr[i + 1].type === 'file' ? '\n' : '\n\n'}`;
      return ret;
    }, '');
  }
}

type REQUEST_BODY = {
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  action?: string;
  save?: boolean;
};

type MESSAGE_TYEP = {
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

export class Chat {
  data: REQUEST_BODY = { ...defaultOpenAioptions };
  self: Toolbox;
  title = '';
  messages: MESSAGE_TYEP[] = [];
  rpomptName: string;
  promptContent: string;
  saveChatFile: TFile;
  isStopped = true;
  constructor(self: Toolbox) {
    this.self = self;
  }

  async getTitle(updateText: (text: string) => void) {
    await this.openChat({ role: 'user', content: '根据上面的内容给我一个简短的标题吧，不超过十个字', type: 'title' }, async text => {
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

    this.rpomptName = name;
    this.promptContent = (await this.self.app.vault.cachedRead(file)).replace(/---[\s\S]*?---/, '');
    const frontmatter = this.self.app.metadataCache.getFileCache(file)?.frontmatter || {};
    this.data.frequency_penalty = Number(frontmatter.frequency_penalty || defaultOpenAioptions.frequency_penalty);
    this.data.presence_penalty = Number(frontmatter.presence_penalty || defaultOpenAioptions.presence_penalty);
    this.data.temperature = Number(frontmatter.temperature || defaultOpenAioptions.temperature);
    this.data.max_tokens = frontmatter.max_tokens ? Number(frontmatter.max_tokens) : null;
    this.data.top_p = Number(frontmatter.top_p || defaultOpenAioptions.top_p);
    this.data.action = frontmatter.action || defaultOpenAioptions.action;
    this.data.save = Boolean(frontmatter.save || defaultOpenAioptions.save);
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
    if (typeof messgae === 'string') {
      messgae = [{ content: messgae, role: 'user', type: 'question' }];
    } else if (!Array.isArray(messgae)) {
      messgae = [messgae];
    }

    const type = messgae[0].type;
    this.promptContent && this.messages.push({ role: 'system', content: this.promptContent, type: 'prompt' });
    this.promptContent = null;
    this.messages = this.messages.concat(messgae);
    const answer: MESSAGE_TYEP = { role: 'system', content: '', type: type === 'question' ? 'answer' : type };
    this.messages.push(answer);

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

const actions = [
  {
    value: '默认 😽',
    text: {
      name: 'default',
      icon: 'cat'
    }
  },
  {
    value: '不保存当前对话 🗑️',
    text: {
      name: 'notSaveChat',
      icon: 'trash'
    }
  },
  {
    value: '选中文本替换为第一个回答 ✏️',
    text: {
      name: 'replace',
      icon: 'pencil-line'
    }
  },
  {
    value: '选中文本替换为 wiki 链接（整个对话） 🔗',
    text: {
      name: 'wikiLink',
      icon: 'link'
    }
  }
];

function actionReplace(self: Toolbox, chat: Chat) {
  const content = chat.messages.find(message => message.type === 'answer');
  const editor = self.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
  if (editor) {
    const text = editor.getSelection();
    if (text) {
      editor.replaceSelection(content.content);
    }
  }
}

function actionWikiLink(self: Toolbox, chat: Chat) {
  const editor = self.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
  if (editor) {
    const text = editor.getSelection();
    if (text) {
      editor.replaceSelection(`[[${chat.saveChatFile.path}|${text}]]`);
    }
  }
}

function actionnotSaveChat(self: Toolbox, chat: Chat) {
  chat.stopChat();
  chat.saveChatFile && self.app.vault.delete(chat.saveChatFile);
}
