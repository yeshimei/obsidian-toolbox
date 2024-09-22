import { App, ButtonComponent, Editor, Modal, Platform, Setting } from 'obsidian';
import OpenAI from 'openai';
import { formatFileSize } from 'src/helpers';
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
  const prompts: any = [];

  if (self.settings.chatPromptFolder) {
    const files = self.app.vault.getMarkdownFiles().filter(file => self.hasRootFolder(file, self.settings.chatPromptFolder));
    for (let file of files) {
      const content = await self.app.vault.cachedRead(file);
      prompts.push({ name: file.basename, value: content });
    }
  }

  new PanelChat(self.app, self.settings, selection, prompts, async res => {
    const text = res.reduce((ret, res) => (ret += `# ${res.question}\n\n${res.answer}\n\n`), '');
    const path = self.settings.chatSaveFolder + '/' + Date.now() + '.md';
    const file = await self.app.vault.create(path, text);
    self.app.workspace.getLeaf(false).openFile(file);
  }).open();
}

type conversationHistoryType = { question: string; answer: string }[];

class PanelChat extends Modal {
  app: App;
  settings: any;
  question: string;
  onSubmit: (res: conversationHistoryType) => void;
  p: HTMLElement;
  prompts: any;
  sendBtn: ButtonComponent;
  saveBtn: ButtonComponent;
  conversationHistory: conversationHistoryType = [];
  startAConversation: boolean = false;
  books: any;
  prompt = '';
  content = '';
  fileName = '';
  name = 'AI Chat';
  constructor(app: App, settings: any, content: string, prompts: any, onSubmit: (conversationHistory: conversationHistoryType) => void) {
    super(app);
    this.question = content;
    this.onSubmit = onSubmit;
    this.prompts = prompts;
    this.settings = settings;
    this.app = app;
    this.books = app.vault
      .getMarkdownFiles()
      .map(file => ({
        text: file,
        value: file.path + ' - ' + formatFileSize(file.stat.size)
      }))
      .sort((a, b) => b.text.stat.ctime - a.text.stat.ctime);

    const currentFile = app.workspace.getActiveFile();
    if (currentFile) {
      this.books.unshift({
        text: currentFile,
        value: currentFile.path + ' - ' + formatFileSize(currentFile.stat.size)
      });
    }

    this.books.unshift({
      text: null,
      value: '🔗'
    });
  }

  onOpen() {
    const { contentEl } = this;
    this.setTitle('AI Chat');
    this.p = document.createElement('p');
    this.p.style.whiteSpace = 'pre-wrap';
    contentEl.appendChild(this.p);

    new Setting(contentEl)
      .addTextArea(text => {
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
            await this.startChat();
          });
      }).infoEl.style.display = 'none';

    new Setting(contentEl)
      .addDropdown(cd => {
        cd.addOption('', '选择 prompt');
        this.prompts.forEach((prompt: any) => {
          cd.addOption(JSON.stringify(prompt), prompt.name);
        });
        cd.setValue('');
        cd.onChange((value: any) => {
          value = JSON.parse(value);
          this.prompt = value.value;
          this.name = value.name || 'AI Chat';
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
              this.content = await this.app.vault.cachedRead(text);
              this.fileName = value;
              btn.buttonEl.style.width = 'unset';
            } else {
              btn.setIcon('paperclip');
              this.content = '';
              this.fileName = '';
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
            this.close();
            this.onSubmit(this.conversationHistory);
          });
      });
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }

  async startChat() {
    const question = this.question;
    const c = { question, answer: '' };
    this.conversationHistory.push(c);
    this.p.innerHTML += `<hr>${this.fileName ? `📄 ${this.fileName}\n\n` : ''}<b><i>叫我包仔：</i></b>\n${this.question}\n\n<b><i>${this.name}：</i></b>\n`;
    await callOpenAI(`${this.content}\n${this.prompt}\n${question}`, this.settings.chatUrl, this.settings.chatKey, this.settings.chatModel, text => {
      this.content = this.prompt = this.fileName = null;
      this.p.innerHTML += text;
      c.answer += text;
      this.sendBtn.setDisabled(true);
      this.saveBtn.setDisabled(true);
      if (!text) {
        this.sendBtn.setDisabled(false);
        this.saveBtn.setDisabled(false);
      }
    });
  }
}

async function callOpenAI(content: string, baseURL: string, apiKey: string, model: string, updateText: (text: string) => void): Promise<void> {
  const openai = new OpenAI({
    baseURL,
    apiKey,
    dangerouslyAllowBrowser: true
  });

  const completion = await openai.chat.completions.create({
    messages: [{ role: 'system', content }],
    model,
    stream: true
  });

  for await (const chunk of completion) {
    const text = chunk.choices[0].delta.content;
    updateText(text);
  }
}
