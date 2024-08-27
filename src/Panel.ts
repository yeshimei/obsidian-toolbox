import { App, Editor, Modal, Setting } from 'obsidian';

export class Panel extends Modal {
  title: string;
  content: any;
  onSubmit: () => void;
  onSubmit2: () => void;

  constructor(app: App, title: string, content: any, onSubmit: () => void, onSubmit2: () => void) {
    super(app);
    this.title = title;
    this.content = content;
    this.onSubmit = onSubmit;
    this.onSubmit2 = onSubmit2;
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.title);
    contentEl.setText(this.content);
    new Setting(contentEl).addButton(btn =>
      btn
        .setButtonText('写生词')
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit();
        })
    );

    new Setting(contentEl).addButton(btn =>
      btn
        .setButtonText('写卡片')
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit2();
        })
    );
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}
