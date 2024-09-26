import { Modal, Setting } from 'obsidian';
import { Chat } from 'src/Commands/chat';
import Toolbox from 'src/main';
import { createChatArea, editorBlur } from '../helpers';

export class PanelSearchForWord extends Modal {
  self: Toolbox;
  chat: Chat;
  title: string;
  chatArea: HTMLElement;
  chatContent = '';
  content: any;
  onSubmit: (type: string, chatContent: string) => void;
  constructor(self: Toolbox, title: string, content: any, onSubmit: (type: string, chatContent: string) => void) {
    super(self.app);
    this.self = self;
    this.title = title;
    this.content = content;
    this.onSubmit = onSubmit;
    this.chat = new Chat(self);
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.title);
    contentEl.setText(this.content);
    contentEl.appendChild((this.chatArea = createChatArea()));
    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('写生词')
          .setCta()
          .onClick(() => {
            this.close();
            this.onSubmit('words', this.chatContent);
          })
      )
      .addButton(btn =>
        btn
          .setButtonText('写卡片')
          .setCta()
          .onClick(() => {
            this.close();
            this.onSubmit('card', this.chatContent);
          })
      )
      .addButton(btn =>
        btn
          .setIcon('bot')
          .setCta()
          .onClick(() => {
            this.chat.data.temperature = 0.5;
            const word = this.title.split(' ').shift();
            this.chatArea.innerHTML = '';
            this.chatArea.innerHTML += `<h1>AI Chat</h1>`;
            this.chat.openChat(`我想让成为一个百科，以专业的角度和严谨的知识用一段话来回答我，这段话要求足够全面并且用词讲究。我现在我输入的词条是${word}`, (text, type) => {
              if (type === 'content') {
                this.chatArea.innerHTML += text;
                this.chatContent += text;
                btn.setDisabled(!!text);
              }
            });
          })
      );
  }

  onClose() {
    editorBlur(this.self.app);
    let { contentEl } = this;
    contentEl.empty();
  }
}
