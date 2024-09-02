import { App, Modal, Setting } from 'obsidian';
import { editorBlur } from 'src/helpers';

interface InputBoxData {
  title: string;
  name: string;
  description?: string;
  content?: string;
  submitText?: string;
  onSubmit: (res: string) => void;
}

export default class InputBox extends Modal {
  data: InputBoxData;
  constructor(app: App, data: InputBoxData) {
    super(app);
    this.data = data;
  }

  onOpen() {
    let res: string;
    const { contentEl } = this;
    const { title, name, description, content, submitText = '确定', onSubmit } = this.data;
    this.setTitle(title);
    content && this.setContent(content);
    new Setting(contentEl)
      .setDesc(description)
      .setName(name)
      .addText(text =>
        text.onChange(value => {
          res = value;
        })
      );
    new Setting(contentEl).addButton(btn =>
      btn
        .setButtonText(submitText)
        .setCta()
        .onClick(() => {
          this.close();
          onSubmit(res);
        })
    );
  }

  onClose() {
    editorBlur(this.app);
    let { contentEl } = this;
    contentEl.empty();
  }
}
