import { ButtonComponent, MarkdownView, Modal, Notice, Platform, Setting, TextAreaComponent, TFile } from 'obsidian';
import OpenAI from 'openai';
import { formatFileSize, getBooksList, getOptionList } from 'src/helpers';
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
  filepath: string;
  chatArea: HTMLDivElement;
  fileArea: HTMLDivElement;
  prompts: any[];
  books: any[];
  title = '';
  promptName = 'AI Chat';
  question = '';
  sendBtn: ButtonComponent;
  saveBtn: ButtonComponent;
  textArea: TextAreaComponent;
  constructor(self: Toolbox, content: string) {
    super(self.app);
    this.self = self;
    this.chat = new Chat(self);
    this.question = content;
    this.prompts = getOptionList(self.app, self.settings.chatPromptFolder);
    this.books = getBooksList(self.app);
  }

  onOpen() {
    let defaultTextAreaHeight = '';
    const { contentEl } = this;
    this.setTitle(this.title || 'AI Chat');

    const chatArea = (this.chatArea = document.createElement('div'));
    chatArea.style.whiteSpace = 'pre-wrap';
    chatArea.style.userSelect = 'text';
    chatArea.style.padding = ' 1rem 0';
    contentEl.appendChild(chatArea);

    const fileArea = (this.fileArea = document.createElement('div'));
    fileArea.style.whiteSpace = 'pre-wrap';
    fileArea.style.userSelect = 'text';
    fileArea.style.padding = ' 1rem 0';
    contentEl.appendChild(fileArea);

    contentEl.onclick = evt => {
      const target = evt.target as HTMLElement;
      if (target.classList.contains('__remove')) {
        const { path } = target.dataset;
        const fileToRemove = Array.from(this.files).find((file: TFile) => file.path === path);
        if (fileToRemove) {
          this.files.delete(fileToRemove);
          (target.parentNode as HTMLElement).remove();
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
          this.question = value;
          text.inputEl.style.height = text.inputEl.scrollHeight + 'px';
        });
      })
      .addButton(btn => {
        this.sendBtn = btn;
        btn.buttonEl.style.marginTop = 'auto';
        if (Platform.isMobile) btn.buttonEl.style.width = '3rem';
        btn
          .setIcon('send')
          .setCta()
          .onClick(async () => {
            this.textArea.inputEl.style.height = defaultTextAreaHeight;
            await this.startChat();
          });
      }).infoEl.style.display = 'none';

    new Setting(contentEl)
      .addDropdown(cd => {
        cd.addOption('', '选择 prompt');
        this.prompts.forEach((prompt: any) => {
          cd.addOption(prompt.value, prompt.name);
        });
        cd.setValue('');
        cd.onChange(async (value: any) => {
          this.promptName = value || 'AI Chat';
          await this.chat.specifyPrompt(value);
        });
      })
      .addButton(btn => {
        this.saveBtn = btn;
        if (Platform.isMobile) btn.buttonEl.style.width = '3rem';
        btn.setIcon('paperclip').onClick(() => {
          new FuzzySuggest(this.app, this.books, async ({ text }) => {
            if (text) {
              const fileSize = formatFileSize(text.stat.size);
              const size = this.files.size;
              this.files.add(text);
              const newSize = this.files.size;

              newSize > size && (this.fileArea.innerHTML += `<span>📄 ${text.path} - ${fileSize} <span class="__remove" data-path="${text.path}">🔥</span><br></span>`);
            }
          }).open();
        });
      })
      .addButton(btn => {
        this.saveBtn = btn;
        if (Platform.isMobile) btn.buttonEl.style.width = '3rem';
        btn.setIcon('gallery-horizontal-end').onClick(() => {
          new FuzzySuggest(this.app, getBooksList(this.self.app, this.self.settings.chatSaveFolder), async ({ text }) => this.loadHistoryChat(text.path)).open();
        });
      });
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }

  async startChat() {
    if (!this.chat.isStopped) {
      this.chat.stopChat();
      return;
    }

    let list = '';
    const meesages: MESSAGE_TYEP[] = [{ role: 'user', content: this.question, type: 'question' }];
    this.textArea.setValue('');
    for (let file of this.files) {
      const content = `${file.path}\n${await this.self.app.vault.cachedRead(file)}`;
      meesages.push({ role: 'user', content, type: 'file' });
      list += `📄 ${file.path}\n`;
    }
    this.chatArea.innerHTML += `<hr>${list}<br><br><b><i>叫我包仔：</i></b>\n${this.question}\n\n<b><i>${this.promptName}：</i></b>\n`;

    this.sendBtn.setIcon('circle-slash');
    await this.chat.openChat(meesages, text => {
      this.files.clear();
      this.fileArea.innerHTML = '';
      this.chatArea.innerHTML += text;
      if (!text) {
        this.sendBtn.setIcon('send');

        if (this.title) {
          this.saveChat();
        } else {
          this.chat.getTitle(text => {
            this.title += text;
            this.setTitle(this.title);
            if (!text) {
              this.saveChat();
            }
          });
        }
      }
    });
  }

  async saveChat() {
    let file: TFile;
    const text = this.chat.messages.reduce((ret, res, i, arr) => {
      if (res.type === 'question') ret += res.content.trim().replace(/^</, '') + '\n\n';
      else if (res.type === 'answer') ret += '> ' + res.content.replace(/\n/gm, '\n> ') + '\n\n';
      else if (res.type === 'file') ret += `[[${res.content.split('\n')[0]}]]${arr[i + 1].type === 'file' ? '\n' : '\n\n'}`;
      return ret;
    }, '');
    const sanitizedTitle = this.title.replace(/[\\\/<>\:\|\?]/g, '');
    if (this.filepath) {
      await this.app.vault.adapter.write(this.filepath, text);
    } else {
      this.filepath = this.self.settings.chatSaveFolder + '/' + sanitizedTitle + ' - ' + Date.now() + '.md';
      file = await this.self.app.vault.create(this.filepath, text);
    }
  }

  async loadHistoryChat(path: string) {
    const messages = await this.chat.loadHistoryChat(path);
    this.filepath = path;
    this.title = this.chat.title;
    this.setTitle(this.title);
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
};

type MESSAGE_TYEP = {
  content: string;
  role: 'user' | 'system' | 'assistant';
  name?: string;
  prefix?: string;
  type?: string;
};

export class Chat {
  data: REQUEST_BODY = {};
  self: Toolbox;
  promptContent: string;
  messages: MESSAGE_TYEP[] = [];
  title = '';
  isStopped = true;
  constructor(self: Toolbox) {
    this.self = self;
  }

  async specifyPrompt(name: string) {
    let frequency_penalty = 0;
    let presence_penalty = 0;
    let temperature = 1;
    let max_tokens: number = null;
    let top_p = 1;

    if (name) {
      const path = this.self.settings.chatPromptFolder + '/' + name + '.md';
      const file = this.self.app.vault.getFileByPath(path);
      this.promptContent = await this.self.app.vault.cachedRead(file);
      const frontmatter = this.self.app.metadataCache.getFileCache(file)?.frontmatter || {};
      frequency_penalty = Number(frontmatter.frequency_penalty);
      presence_penalty = Number(frontmatter.presence_penalty);
      temperature = Number(frontmatter.temperature);
      max_tokens = Number(frontmatter.max_tokens);
      top_p = Number(frontmatter.top_p);
    }

    Object.assign(this.data, { frequency_penalty: frequency_penalty, presence_penalty: presence_penalty, max_tokens, temperature: temperature, top_p: top_p });
  }

  async getTitle(updateText: (text: string) => void) {
    await this.openChat({ role: 'user', content: '根据上面的内容给我一个简短的标题吧，不超过十个字', type: 'title' }, async text => {
      updateText(text);
      this.title += text;
    });

    this.messages = this.messages.filter(res => res.type !== 'title');
  }

  async loadHistoryChat(path: string) {
    const file = this.self.app.vault.getFileByPath(path);
    if (file) {
      const content = await this.self.app.vault.cachedRead(file);
      const messages: MESSAGE_TYEP[] = [];
      const items = content.split('\n\n').filter(Boolean);

      for (let item of items) {
        const path = item.match(/\[\[(.+?)\]\]/g);
        if (path) {
          for (let p of path) {
            p = p.slice(2, -2);
            messages.push({ role: 'user', content: `${p}\n${await this.self.app.vault.adapter.read(p)}`, type: 'file' });
          }
        } else if (item.startsWith('> ')) {
          messages.push({ role: 'system', content: item.replace(/^> /gm, ''), type: 'answer' });
        } else {
          messages.push({ role: 'user', content: item, type: 'question' });
        }
      }

      this.messages = messages;
      this.title = file.basename.split(' - ')[0];
      return messages;
    }
  }

  async FIMCompletion(prefix: string, suffix: string, maxLength: number, updateText: (text: string) => void) {
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

  async stopChat() {
    this.isStopped = true;
  }

  async openChat(messgae: MESSAGE_TYEP[] | MESSAGE_TYEP | string, updateText: (text: string) => void): Promise<void> {
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
          updateText('');
          break;
        }

        const choices = chunk.choices as any;
        const text = choices[0].delta.content;
        const finish = (this.isStopped = choices[0].finish_reason);
        if (text || finish) {
          updateText(text);
          answer.content += text;
        }
      }
    } catch (error) {
      new Notice(error.message);
    }
  }
}
