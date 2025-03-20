import { ButtonComponent, DropdownComponent, MarkdownView, Modal, Setting, TextAreaComponent, TFile } from 'obsidian';
import { createChatArea, formatFileSize, getBooksList, getOptionList } from 'src/helpers';
import Toolbox from 'src/main';
import FuzzySuggest from 'src/Modals/FuzzySuggest';
import actions from './AIChatAction';
import inPrompts from './AIChatInPrompt';
import { MESSAGE_TYPE } from './AIChatManager';
import AIChatManager from './AIChatManager';

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
  chat: AIChatManager;
  self: Toolbox;
  files: Set<TFile> = new Set();
  chatArea: HTMLDivElement;
  fileArea: HTMLDivElement;
  promptName = 'AI Chat';
  action = 'default';
  question = '';
  sendBtn: ButtonComponent;
  attachmentBtn: ButtonComponent;
  saveBtn: ButtonComponent;
  actionBtn: ButtonComponent;
  textArea: TextAreaComponent;
  defaultTextAreaHeight = 80;
  constructor(self: Toolbox, content: string) {
    super(self.app);
    this.self = self;
    this.chat = new AIChatManager(self);
    this.question = content;
    this.attachmentHandler();
  }

  onOpen() {
    const { contentEl } = this;
    this.setTitle(this.promptName);
    
    contentEl.appendChild((this.chatArea = createChatArea()));
    contentEl.appendChild((this.fileArea = createChatArea()));
    this.chatArea.style.overflow = 'auto'

    this.chat.model = this.self.settings.chatDefaultUsingR1 ? 'deepseek-reasoner' : null

    new Setting(contentEl)
      .addTextArea(text => this.setTextArea(text))
      // 发送
      .addButton(btn => this.setSend(btn)).infoEl.style.display = 'none';
    new Setting(contentEl)
      // 选择一个 prompt
      .addDropdown(cd => this.setPrompt(cd))
      // 打开历史对话
      .addButton(btn => this.deepReasoning(btn))
      // 选择一篇笔记作为附件
      .addButton(btn => this.setAttachment(btn))
      // 打开历史对话
      .addButton(btn => this.setHistoryChat(btn))
      // 选择一个 Action
      .addButton(btn => this.setAction(btn));
  }

  attachmentHandler() {
    this.contentEl.onclick = evt => {
      const target = evt.target as HTMLElement;
      if (target.classList.contains('__remove')) {
        const { path } = target.dataset;
        const fileToRemove = Array.from(this.files).find((file: TFile) => file.path === path);
        if (fileToRemove) {
          this.files.delete(fileToRemove);
          const size = this.files.size;
          (target.parentNode as HTMLElement).remove();
          size ? this.attachmentBtn.setCta() : this.attachmentBtn.removeCta();
          this.sendBtn.setDisabled(!size);
        }
      }
      
    };
  }

  setSend(btn: ButtonComponent) {
    this.sendBtn = btn;
    btn.buttonEl.style.marginTop = 'auto';
    btn.buttonEl.style.width = '2rem';
    btn
      .setIcon('send')
      .setDisabled(!this.question)
      .setCta()
      .onClick(async () => {
        this.textArea.inputEl.style.height = this.defaultTextAreaHeight + 'px';

        if (this.promptName.indexOf('in-') === 0) {
          const name = this.promptName.split('-').pop();
          this.clearChat();
          inPrompts[name].fn(this.self, this.chat, (text, type) => type === 'content' && this.updateChat(text));
        } else {
          this.startChat();
        }
      });
  }

  setTextArea(text: TextAreaComponent) {
    this.textArea = text;
    text.inputEl.style.width = '100%';
    text.inputEl.style.height = this.defaultTextAreaHeight + 'px';
    text.setValue(this.question).onChange(value => {
      this.sendBtn.setDisabled(!value);
      this.question = value;
      text.inputEl.style.height = Math.max(text.inputEl.scrollHeight, this.defaultTextAreaHeight) + 'px';
    });
  }

  choiceAction(name: string) {
    name || (name = 'default');
    this.action = name;
    this.actionBtn.setIcon(actions.find(a => a.text.name === name).text.icon);
    this.action === 'default' ? this.actionBtn.removeCta() : this.actionBtn.setCta();
  }

  async choicePrompt(value: string) {
    const isInPrompt = value.indexOf('in-') === 0;
    const { description, actionName, title } = inPrompts[value.split('-').pop()] || ([] as any);
    if (value.indexOf('in-') === 0) {
      this.sendBtn.setDisabled(false);
      this.textArea.setDisabled(true);
      this.attachmentBtn.setDisabled(true);
      this.saveBtn.setDisabled(true);
      this.textArea.setValue(description);
    } else {
      this.sendBtn.setDisabled(!this.question);
      this.textArea.setDisabled(false);
      this.attachmentBtn.setDisabled(false);
      this.saveBtn.setDisabled(false);
      this.textArea.setValue(this.question);
    }

    this.promptName = value || 'AI Chat';
    this.setTitle(isInPrompt ? title : this.promptName);
    await this.chat.specifyPrompt(value);
    this.choiceAction(isInPrompt ? actionName : this.chat.data.action);
  }

  setPrompt(cd: DropdownComponent) {
    cd.addOption('', '选择 prompt');
    // 内置 prompt
    Object.entries(inPrompts).forEach(([key, value]) => {
      cd.addOption('in-' + key, value.title + '（内置）');
    });
    // 用户自定义 prompt
    getOptionList(this.self.app, this.self.settings.chatPromptFolder).forEach((prompt: any) => {
      cd.addOption(prompt.value, prompt.name);
    });
    cd.setValue('');
    cd.onChange(async value => this.choicePrompt(value));
  }

  deepReasoning(btn: ButtonComponent) {
    btn.buttonEl.style.width = '2rem';

    if (this.chat.model) {
      btn.setCta();
      btn.setIcon('circle-dot-dashed');
    } else {
      btn.removeCta();
      btn.setIcon('circle-dashed');
    }

    btn.onClick(() => {
      if (this.chat.model) {
        this.chat.model = null;
        btn.removeCta();
        btn.setIcon('circle-dashed');
      } else {
        this.chat.model = 'deepseek-reasoner';
        btn.setCta();
        btn.setIcon('circle-dot-dashed');
      }
    })

  }

  setAttachment(btn: ButtonComponent) {
    this.attachmentBtn = btn;
    btn.buttonEl.style.width = '2rem';

    btn.setIcon('paperclip').onClick(() => {
      new FuzzySuggest(this.app, this.getAttachmentList(), async ({ text }) => {
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
  }

  setHistoryChat(btn: ButtonComponent) {
    this.saveBtn = btn;
    btn.buttonEl.style.width = '2rem';
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
  }

  setAction(btn: ButtonComponent) {
    this.actionBtn = btn;
    btn.buttonEl.style.width = '2rem';
    btn.setIcon(actions[0].text.icon).onClick(() => {
      new FuzzySuggest(this.app, actions, async ({ text }) => this.choiceAction(text.name)).open();
    });
  }

  getAttachmentList() {
    const list = getBooksList(this.self.app).map(({ text }) => ({
      value: text.path + ' - ' + formatFileSize(text.stat.size),
      text: text
    }));
    const currentFile = this.self.app.workspace.getActiveFile();
    if (currentFile) {
      list.unshift({
        text: currentFile,
        value: currentFile.path + ' - ' + formatFileSize(currentFile.stat.size)
      });
    }
    return list;
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
    actions.find(a => a.text.name === this.action)?.text?.fn.call(this);
  }

  async startChat() {
    if (!this.chat.isStopped) {
      this.chat.stopChat();
      return;
    }

    let question = this.question || '';
    let list = '';
    const message: MESSAGE_TYPE = { role: 'user', content: question, type: 'question', files: [] };
    this.textArea.setValue('');
    for (let file of this.files) {
      const content = await this.self.app.vault.cachedRead(file)
      message.content = content + '\n\n' + message.content;
      message.files.push(file.path);
      list += `📄 ${file.path}\n`;
    }
    this.chatArea.innerHTML += `<hr>${list}<b><i>叫我包仔：</i></b>\n${this.question}\n\n<b><i>${this.promptName}：</i></b>\n`;
    this.question = '';
    let isReasoningContent = true
    let isContent = true
    let reasoningContentEl: HTMLElement
    this.sendBtn.setIcon('circle-slash');
    await this.chat.openChat(message, (text, type) => {
      this.files.clear();
      this.fileArea.innerHTML = '';
      if (type === 'reasoning_content') {
        if (isReasoningContent) {
          reasoningContentEl = document.createElement('span') as HTMLElement
          reasoningContentEl.style.opacity = '.5'
          this.chatArea.appendChild(reasoningContentEl);
          isReasoningContent = false
        }
        reasoningContentEl.innerText += text;
      } 
      else if (type === 'content') {
        if (!isReasoningContent && isContent) {
          text = '\n\n' + text;
          isContent = false
        }
        this.updateChat(text);
      } else if (type === 'title') {
        this.chat.title && this.setTitle(this.chat.title);
      } else if (type === 'stop') {
        isReasoningContent = true
        isContent = true
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

  updateChat(content: string) {
    this.chatArea.innerHTML += content;
  }

  clearChat() {
    this.chatArea.innerHTML = '';
  }
}
