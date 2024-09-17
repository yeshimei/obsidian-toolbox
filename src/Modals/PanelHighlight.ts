import { App, Modal, Setting } from 'obsidian';
import { editorBlur } from 'src/helpers';

export default class PanelHighlight extends Modal {
  content?: string;
  onSubmit: (res: string, tagging: string) => void;
  constructor(app: App, content: string, onSubmit: (res: string, tagging: string) => void) {
    super(app);
    this.content = content;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    let res: string;
    let tagging: string;
    const { contentEl } = this;
    this.setTitle('划线');
    this.setContent(this.content);
    new Setting(contentEl).setName('想法').addText(text =>
      text.onChange(value => {
        res = value;
      })
    );
    new Setting(contentEl).setName('标注（可选）').addText(text =>
      text.onChange(value => {
        tagging = value;
      })
    );
    new Setting(contentEl).addButton(btn =>
      btn
        .setButtonText('划线')
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit(res, tagging);
        })
    );
  }

  onClose() {
    editorBlur(this.app);
    let { contentEl } = this;
    contentEl.empty();
  }
}
