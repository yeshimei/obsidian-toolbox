import { App, Modal, Setting } from "obsidian";

export class InputBox extends Modal {
	result: string;
	text: string;
	buttonText: string;
	onSubmit: (result: string) => void;

	constructor(
		app: App,
		text: string,
		buttonText: string,
		onSubmit: (result: string) => void
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.text = text;
		this.buttonText = buttonText;
	}

	onOpen() {
		const { contentEl } = this;

		new Setting(contentEl).setDesc(this.text);
		new Setting(contentEl).addText((text) =>
			text.onChange((value) => {
				this.result = value;
			})
		);
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
