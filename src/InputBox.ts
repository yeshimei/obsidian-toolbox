import { App, MarkdownView, Modal, Setting } from 'obsidian';
import { blur } from './helpers';

export class PanelHighlight extends Modal {
  result: string;
  title: string;
  text: string;
  buttonText: string;
  onSubmit: (result: string) => void;

  constructor(app: App, title: string, text: string, buttonText: string, onSubmit: (result: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
    this.title = title;
    this.text = text;
    this.buttonText = buttonText;
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.title);
    contentEl.setText(this.text);
    new Setting(contentEl).addText(text =>
      text.onChange(value => {
        this.result = value;
      })
    );
    new Setting(contentEl).addButton(btn =>
      btn
        .setButtonText(this.buttonText)
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit(this.result);
        })
    );
  }

  onClose() {
    blur(this.app);
    let { contentEl } = this;
    contentEl.empty();
  }
}
