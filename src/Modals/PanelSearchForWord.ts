import { App, Modal, Setting } from 'obsidian';
import { editorBlur } from '../helpers';

export class PanelSearchForWord extends Modal {
  title: string;
  content: any;
  onSubmit: (type: string) => void;
  constructor(app: App, title: string, content: any, onSubmit: (type: string) => void) {
    super(app);
    this.title = title;
    this.content = content;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.title);
    contentEl.setText(this.content);
    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('写生词')
          .setCta()
          .onClick(() => {
            this.close();
            this.onSubmit('words');
          })
      )
      .addButton(btn =>
        btn
          .setButtonText('写卡片')
          .setCta()
          .onClick(() => {
            this.close();
            this.onSubmit('card');
          })
      )
      .addButton(btn =>
        btn
          .setIcon('bot')
          .setCta()
          .onClick(() => {
            this.close();
            this.onSubmit('ai');
          })
      );
  }

  onClose() {
    editorBlur(this.app);
    let { contentEl } = this;
    contentEl.empty();
  }
}
