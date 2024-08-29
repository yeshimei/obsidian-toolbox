import { App, MarkdownView, Modal, Setting } from 'obsidian';

export class PanelSearchForPlants extends Modal {
  result: string;
  onSubmit: (result: string) => void;

  constructor(app: App, onSubmit: (result: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    new Setting(contentEl).addText(text =>
      text.onChange(value => {
        this.result = value;
      })
    );
    new Setting(contentEl).addButton(btn =>
      btn
        .setButtonText('查植物')
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit(this.result);
        })
    );
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}
