import { App, Modal, Setting } from 'obsidian';

interface ConfirmData {
  title?: string;
  content?: string;
  submitText?: string;
  cancelText?: string;
  onSubmit: (res: boolean) => void;
}

export default class Confirm extends Modal {
  data: ConfirmData;
  constructor(app: App, data: ConfirmData) {
    super(app);
    this.data = data;
  }

  onOpen() {
    const { contentEl } = this;
    const { title, content, submitText = '确定', cancelText = '取消', onSubmit } = this.data;
    title && this.setTitle(title);
    content && this.setContent(content);
    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText(submitText)
          .setCta()
          .onClick(() => {
            this.close();
            onSubmit(true);
          })
      )
      .addButton(btn =>
        btn
          .setButtonText('取消')
          .setCta()
          .onClick(() => {
            this.close();
            onSubmit(false);
          })
      );
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}
