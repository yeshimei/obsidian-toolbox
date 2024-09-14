import { App, MarkdownView, Modal, Setting } from 'obsidian';

export class PanelExhibition extends Modal {
  title: string;
  content: any;
  onSubmit: () => void;

  constructor(app: App, title: string, content: any, onSubmit: () => void = null) {
    super(app);
    this.title = title;
    this.content = content;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.title);
    contentEl.setText(this.content);

    if (this.onSubmit) {
      new Setting(contentEl).addButton(btn =>
        btn
          .setButtonText('查看')
          .setCta()
          .onClick(() => {
            this.close();
            this.onSubmit();
          })
      );
    }
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}