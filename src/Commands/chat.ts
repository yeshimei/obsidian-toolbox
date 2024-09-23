import { ButtonComponent, Editor, Modal, Notice, Platform, Setting, TextAreaComponent, TFile } from 'obsidian';
import OpenAI from 'openai';
import { formatFileSize, getBooksList, getOptionList } from 'src/helpers';
import Toolbox from 'src/main';
import FuzzySuggest from 'src/Modals/FuzzySuggest';

export default function chatCommand(self: Toolbox) {
  self.settings.searchForWords &&
    self.addCommand({
      id: 'AI Chat',
      name: 'AI Chat',
      icon: 'bot',
      editorCallback: editor => chat(self, editor)
    });
}

export async function chat(self: Toolbox, editor: Editor | string) {
  if (!self.settings.chat) return;
  const selection = typeof editor === 'string' ? editor : editor.getSelection();
  new PanelChat(self, selection).open();
}

class PanelChat extends Modal {
  chat: Chat;
  self: Toolbox;
  file: TFile;
  p: HTMLElement;
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
    const { contentEl } = this;
    this.setTitle(this.title || 'AI Chat');
    this.p = document.createElement('p');
    this.p.style.whiteSpace = 'pre-wrap';
    contentEl.appendChild(this.p);

    new Setting(contentEl)
      .addTextArea(text => {
        this.textArea = text;
        text.inputEl.style.width = '100%';
        text.setValue(this.question).onChange(value => {
          this.question = value;
          this.sendBtn.setDisabled(!value);
          text.inputEl.style.height = text.inputEl.scrollHeight + 'px';
        });
        text.inputEl.style.height = text.inputEl.scrollHeight + 'px';
      })
      .addButton(btn => {
        this.sendBtn = btn;
        btn.buttonEl.style.marginTop = 'auto';
        if (Platform.isMobile) btn.buttonEl.style.width = '3rem';
        btn
          .setIcon('send')
          .setDisabled(!this.question)
          .setCta()
          .onClick(async () => {
            this.textArea.setValue('');
            this.textArea.inputEl.style.height = '35px';
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
          this.sendBtn.setDisabled(false);
        });
      })
      .addButton(btn => {
        this.saveBtn = btn;
        if (Platform.isMobile) btn.buttonEl.style.width = '3rem';
        btn.setIcon('paperclip').onClick(() => {
          new FuzzySuggest(this.app, this.books, async ({ text, value }) => {
            if (text) {
              btn.setIcon('');
              btn.setButtonText(text.basename + ' - ' + formatFileSize(text.stat.size));
              this.file = text;
              btn.buttonEl.style.width = 'unset';
            } else {
              btn.setIcon('paperclip');
              this.file = null;
              btn.buttonEl.style.width = '3rem';
            }
          }).open();
        });
      })
      .addButton(btn => {
        this.saveBtn = btn;
        if (Platform.isMobile) btn.buttonEl.style.width = '3rem';
        btn
          .setIcon('save')
          .setDisabled(!this.question)
          .onClick(() => {
            this.saveChat();
            this.close();
          });
      });
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }

  async startChat() {
    let index = 0;
    const content = this.file && (await this.self.app.vault.cachedRead(this.file));
    const list = this.file ? `📄 ${this.file.path}\n\n` : '';
    this.p.innerHTML += `<hr>${list}<b><i>叫我包仔：</i></b>\n${this.question}\n\n<b><i>${this.promptName}：</i></b>\n`;
    const messgae = content ? `${content}\n${this.question}` : this.question;
    await this.chat.open(messgae, text => {
      index++;
      let iconIndex = Math.floor(index / 10) % 4;
      this.sendBtn.setIcon(iconIndex === 0 ? 'cloud' : iconIndex === 1 ? 'cloud-fog' : iconIndex === 2 ? 'cloud-lightning' : 'cloud-drizzle');

      this.question = this.file = null;
      this.p.innerHTML += text;
      this.sendBtn.setDisabled(true);
      this.saveBtn.setDisabled(true);
      if (!text && index > 2) {
        // 获取标题
        if (!this.title) {
          this.chat.getTitle(text => {
            this.title += text;
            this.setTitle(this.title);
          });
        }
        this.sendBtn.setDisabled(false);
        this.saveBtn.setDisabled(false);
        this.sendBtn.setIcon('send');
      }
    });
  }

  async saveChat() {
    const text = this.chat.messages.reduce((ret, res) => {
      if (res.type === 'question') ret += res.content + '\n\n';
      if (res.type === 'answer') ret += '> ' + res.content.replace(/\n/gm, '\n> ') + '\n\n';
      return ret;
    }, '');

    const path = this.self.settings.chatSaveFolder + '/' + this.title + '-' + Date.now() + '.md';
    const file = await this.self.app.vault.create(path, text);
    this.self.app.workspace.getLeaf(false).openFile(file);
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
  type?: 'prompt' | 'question' | 'answer';
  noSave?: boolean;
};

export class Chat {
  data: REQUEST_BODY = {};
  self: Toolbox;
  promptContent: string;
  messages: MESSAGE_TYEP[] = [];
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
      frequency_penalty = frontmatter.frequency_penalty;
      presence_penalty = frontmatter.presence_penalty;
      temperature = frontmatter.temperature;
      max_tokens = frontmatter.max_tokens;
      top_p = frontmatter.top_p;
    }

    Object.assign(this.data, { frequency_penalty: frequency_penalty, presence_penalty: presence_penalty, max_tokens, temperature: temperature, top_p: top_p });
  }

  async getTitle(updateText: (text: string) => void) {
    this.open({ role: 'user', content: '根据上面的内容给我一个简短的标题吧，不超过十个字', noSave: true }, async text => {
      updateText(text);
    });
  }

  async open(messgae: MESSAGE_TYEP | string, updateText: (text: string) => void): Promise<void> {
    const { chatKey, chatUrl, chatModel } = this.self.settings;

    if (typeof messgae === 'string') {
      messgae = { content: messgae, role: 'user', type: 'question' };
    }
    this.promptContent && this.messages.push({ role: 'system', content: this.promptContent, type: 'prompt' });
    this.promptContent = null;
    this.messages.push(messgae);
    const answer: MESSAGE_TYEP = { role: 'system', content: '', type: 'answer' };
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
        const text = chunk.choices[0].delta.content;
        updateText(text);
        answer.content += text;
      }

      if (messgae.noSave) {
        this.messages = this.messages.slice(0, -2);
      }
    } catch (error) {
      new Notice(error.message);
    }
  }
}
