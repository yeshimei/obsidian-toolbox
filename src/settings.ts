import { App, PluginSettingTab, Setting } from "obsidian";
import Toolbox from "./main";

export interface ToolboxSettings {
	passwordCreator: boolean;
	passwordCreatorMixedContent: string;
	passwordCreatorLength: number;

	polysemy: boolean;
}

export const DEFAULT_SETTINGS: ToolboxSettings = {
	passwordCreator: true,
	passwordCreatorMixedContent:
		"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+",
	passwordCreatorLength: 16,
	polysemy: true,
};

export class ToolboxSettingTab extends PluginSettingTab {
	plugin: Toolbox;

	constructor(app: App, plugin: Toolbox) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		let { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: this.plugin.manifest.name });

		new Setting(containerEl).setName("🔑 密码创建器").addToggle((cd) =>
			cd
				.setValue(this.plugin.settings.passwordCreator)
				.onChange(async (value) => {
					this.plugin.settings.passwordCreator = value;
					await this.plugin.saveSettings();
					this.display();
				})
		);

		if (this.plugin.settings.passwordCreator) {
			new Setting(containerEl)
				.setName("从哪些字符中随机生成密码？")
				.addText((cd) =>
					cd
						.setValue(
							"" +
								this.plugin.settings.passwordCreatorMixedContent
						)
						.onChange(async (value) => {
							this.plugin.settings.passwordCreatorMixedContent =
								value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl).setName("生成密码的长度？").addText((cd) =>
				cd
					.setValue("" + this.plugin.settings.passwordCreatorLength)
					.onChange(async (value) => {
						this.plugin.settings.passwordCreatorLength =
							Number(value);
						await this.plugin.saveSettings();
					})
			);
		}

		new Setting(containerEl)
			.setName("🔗 多义笔记转跳")
			.setDesc(
				'在笔记属性里添加 to 字段，例如 to: "[[filename or path]]"'
			)
			.addToggle((cd) =>
				cd
					.setValue(this.plugin.settings.polysemy)
					.onChange(async (value) => {
						this.plugin.settings.polysemy = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);
	}
}
