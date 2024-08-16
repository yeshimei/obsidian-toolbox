import { App, Modal, Setting } from "obsidian";

export class Panel extends Modal {
	result: string;
	title: string;
	content: any;
	buttonText: string;
	onSubmit: (result: string) => void;

	constructor(
		app: App,
		title: string,
		content: any,
		buttonText: string,
		onSubmit: (result: string) => void
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.title = title;
		this.content = content;
		this.buttonText = buttonText;
	}

	onOpen() {
		const { contentEl, titleEl } = this;
		titleEl.setText(this.title);
		contentEl.setText(this.content);
		// new Setting(contentEl).setDesc(this.text);

		new Setting(contentEl).addButton((btn) =>
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
		let { contentEl } = this;
		contentEl.empty();
	}
}
