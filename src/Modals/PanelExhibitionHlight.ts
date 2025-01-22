import { App, Modal, Setting } from 'obsidian';
import { render } from 'src/helpers';

export class PanelExhibitionHlight extends Modal {
  title: string;
  content: any;
  onTrash: () => void;
  onEdit: () => void;

  constructor(app: App, title: string, content: any, onTrash: () => void = null, onEdit: () => void = null) {
    super(app);
    this.title = title;
    this.content = content;
    this.onTrash = onTrash;
    this.onEdit = onEdit;
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.title);
    render(this.app, this.content, contentEl);
    new Setting(contentEl)
      .addButton(btn =>
        btn.setIcon('trash').onClick(() => {
          this.close();
          this.onTrash();
        })
      )
      .addButton(btn =>
        btn
          .setIcon('pencil-line')
          .setDisabled(true)
          .onClick(() => {
            this.close();
            this.onTrash();
          })
      );
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}
