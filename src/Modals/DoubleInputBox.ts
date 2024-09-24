import { App, Modal, Setting } from 'obsidian';
import { editorBlur } from 'src/helpers';

interface DoubleInputBoxData {
  title: string;
  titleName: string;
  textName: string;
  titleDescription?: string;
  textDescription?: string;
  content?: string;
  submitText?: string;
  onSubmit: (res1: string, res2: string) => void;
}

export default class DoubleInputBox extends Modal {
  data: DoubleInputBoxData;
  constructor(app: App, data: DoubleInputBoxData) {
    super(app);
    this.data = data;
  }

  onOpen() {
    let res1: string;
    let res2: string;
    const { contentEl } = this;
    const { title, titleName, textName, titleDescription = '', textDescription = '', content, submitText = '确定', onSubmit } = this.data;
    this.setTitle(title);
    content && this.setContent(content);
    new Setting(contentEl)
      .setDesc(titleDescription)
      .setName(titleName)
      .addText(text =>
        text.onChange(value => {
          res1 = value;
        })
      );

    new Setting(contentEl)
      .setDesc(textDescription)
      .setName(textName)
      .addTextArea(text => {
        text.inputEl.style.width = '100%';
        text.onChange(value => {
          text.inputEl.style.height = text.inputEl.scrollHeight + 'px';
          res2 = value;
        });
      }).infoEl.style.display = 'none';

    new Setting(contentEl).addButton(btn =>
      btn
        .setButtonText(submitText)
        .setCta()
        .onClick(() => {
          this.close();
          onSubmit(res1, res2);
        })
    );
  }

  onClose() {
    editorBlur(this.app);
    let { contentEl } = this;
    contentEl.empty();
  }
}
