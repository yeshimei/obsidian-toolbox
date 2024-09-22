import { App, ButtonComponent, Editor, Modal, Platform, Setting } from 'obsidian';
import OpenAI from 'openai';
import Toolbox from 'src/main';

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
  settings: any;
  content: string;
  onSubmit: (res: conversationHistoryType) => void;
  p: HTMLElement;
  prompts: any;
  sendBtn: ButtonComponent;
  saveBtn: ButtonComponent;
  conversationHistory: conversationHistoryType = [];
  startAConversation: boolean = false;
  constructor(app: App, settings: any, content: string, prompts: any, onSubmit: (conversationHistory: conversationHistoryType) => void) {
    super(app);
    this.content = content;
    this.onSubmit = onSubmit;
    this.prompts = prompts;
    this.settings = settings;
  }

  onOpen() {
    let prompt: string;
    const { contentEl } = this;
    this.setTitle('AI Chat');
    this.p = document.createElement('p');
    this.p.style.whiteSpace = 'pre-wrap';
    contentEl.appendChild(this.p);

    new Setting(contentEl)
      .addTextArea(text => {
        text.inputEl.style.width = '100%';
        text.setValue(this.content).onChange(value => {
          this.content = value;
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
          .setDisabled(!this.content)
          .setCta()
          .onClick(async () => {
            await this.startChat(prompt);
          });
      }).infoEl.style.display = 'none';

    new Setting(contentEl)
      .addDropdown(cd => {
        cd.addOption('', '选择 prompt');
        this.prompts.forEach((prompt: any) => {
          cd.addOption(prompt.value, prompt.name);
        });
        cd.setValue('');
        cd.onChange(value => {
          this.startAConversation = false;
          prompt = value;
        });
      })
      .addButton(btn => {
        this.saveBtn = btn;
        if (Platform.isMobile) btn.buttonEl.style.width = '3rem';
        btn
          .setIcon('save')
          .setDisabled(!this.content)
          .onClick(() => {
            this.onSubmit(this.conversationHistory);
            this.onClose();
          });
      });
  }

  onClose() {
    this.close();
  }

  async startChat(prompt = '') {
    const question = this.content;
    const c = { question, answer: '' };
    this.conversationHistory.push(c);
    const name = this.prompts.find((p: any) => p.value === prompt)?.name || 'AI Chat';
    this.p.innerHTML += `${this.conversationHistory.length > 1 ? '<hr>' : ''}<b><i>叫我包仔：</i></b>\n${question || prompt}\n\n<b><i>${name}：\n</i></b>`;
    await callOpenAI(`${this.content}\n${this.startAConversation ? '' : prompt}\n${question}\n\n`, this.settings.chatUrl, this.settings.chatKey, this.settings.chatModel, text => {
      this.startAConversation = true;
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
