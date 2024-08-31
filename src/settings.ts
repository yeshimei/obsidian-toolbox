import { App, PluginSettingTab, Setting } from "obsidian";
import Toolbox from "./main";

export interface ToolboxSettings {
	passwordCreator: boolean;
	passwordCreatorMixedContent: string;
	passwordCreatorLength: number;

	polysemy: boolean;
	footnoteRenumbering: boolean;

	searchForWords: boolean;

	flip: boolean;
	fileCorrect: number;

	readDataTracking: boolean;
	readDataTrackingFolder: string;
	readDataTrackingTimeout: number;

	drawALine: boolean;

	readingNotes: boolean;
	readingNotesToFolder: string;
	outLink: boolean;
	blockId: boolean;
	frontmatter: boolean;
}

export const DEFAULT_SETTINGS: ToolboxSettings = {
	passwordCreator: true,
	passwordCreatorMixedContent:
		"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+",
	passwordCreatorLength: 16,
	polysemy: true,
	footnoteRenumbering: true,
	searchForWords: true,

	flip: true,
	fileCorrect: -35,

	readDataTracking: true,
	readDataTrackingFolder: "书库",
	readDataTrackingTimeout: 300 * 1000,

	drawALine: true,

	readingNotes: true,
	readingNotesToFolder: "书库/读书笔记",
	outLink: true,
	blockId: true,
	frontmatter: true,
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
		containerEl.createEl("h1", { text: this.plugin.manifest.name });

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
				.setName("- 从指定字符集中随机生成密码")
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

			new Setting(containerEl).setName("- 生成密码的长度").addText((cd) =>
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
			.setDesc('to: "[[filename or path]]"')
			.addToggle((cd) =>
				cd
					.setValue(this.plugin.settings.polysemy)
					.onChange(async (value) => {
						this.plugin.settings.polysemy = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl).setName("🏷️ 脚注重编号").addToggle((cd) =>
			cd
				.setValue(this.plugin.settings.footnoteRenumbering)
				.onChange(async (value) => {
					this.plugin.settings.footnoteRenumbering = value;
					await this.plugin.saveSettings();
					this.display();
				})
		);

		new Setting(containerEl).setName("🔎 查词").addToggle((cd) =>
			cd
				.setValue(this.plugin.settings.searchForWords)
				.onChange(async (value) => {
					this.plugin.settings.searchForWords = value;
					await this.plugin.saveSettings();
					this.display();
				})
		);

		new Setting(containerEl).setName("👇🏼 翻页").addToggle((cd) =>
			cd.setValue(this.plugin.settings.flip).onChange(async (value) => {
				this.plugin.settings.flip = value;
				await this.plugin.saveSettings();
				this.display();
			})
		);

		if (this.plugin.settings.flip) {
			new Setting(containerEl).setName("- 修正值").addText((cd) =>
				cd
					.setValue("" + this.plugin.settings.fileCorrect)
					.onChange(async (value) => {
						this.plugin.settings.fileCorrect = Number(value);
						await this.plugin.saveSettings();
					})
			);
		}

		new Setting(containerEl)
			.setName("🕐 阅读数据跟踪")
			.setDesc("阅读进度、时长，未读以及读完")
			.addToggle((cd) =>
				cd
					.setValue(this.plugin.settings.readDataTracking)
					.onChange(async (value) => {
						this.plugin.settings.readDataTracking = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		if (this.plugin.settings.readDataTracking) {
			new Setting(containerEl).setName("- 跟踪哪个文件夹").addText((cd) =>
				cd
					.setValue("" + this.plugin.settings.readDataTrackingFolder)
					.onChange(async (value) => {
						this.plugin.settings.readDataTrackingFolder = value;
						await this.plugin.saveSettings();
					})
			);

			new Setting(containerEl)
				.setName("- 超时")
				.setDesc(
					`超过一段时间未翻页将暂停跟踪阅读时长，以获得更准确的数据。`
				)
				.addText((cd) =>
					cd
						.setValue(
							"" + this.plugin.settings.readDataTrackingTimeout
						)
						.onChange(async (value) => {
							this.plugin.settings.readDataTrackingTimeout =
								Number(value);
							await this.plugin.saveSettings();
						})
				);
		}

		new Setting(containerEl).setName("✏️ 划线").addToggle((cd) =>
			cd
				.setValue(this.plugin.settings.drawALine)
				.onChange(async (value) => {
					this.plugin.settings.drawALine = value;
					await this.plugin.saveSettings();
					this.display();
				})
		);

		new Setting(containerEl).setName("📙 同步读书笔记").addToggle((cd) =>
			cd
				.setValue(this.plugin.settings.readingNotes)
				.onChange(async (value) => {
					this.plugin.settings.readingNotes = value;
					await this.plugin.saveSettings();
					this.display();
				})
		);

		if (this.plugin.settings.readingNotes) {
			new Setting(containerEl)
				.setName("- 同步至哪个文件夹")
				.addText((cd) =>
					cd
						.setValue(
							"" + this.plugin.settings.readingNotesToFolder
						)
						.onChange(async (value) => {
							this.plugin.settings.readingNotesToFolder = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl).setName("- 同步出链").addToggle((cd) =>
				cd
					.setValue(this.plugin.settings.outLink)
					.onChange(async (value) => {
						this.plugin.settings.outLink = value;
						await this.plugin.saveSettings();
					})
			);

			new Setting(containerEl)
				.setName("- 同步元字段")
				.setDesc("添加划线，想法和出链数量元字段")
				.addToggle((cd) =>
					cd
						.setValue(this.plugin.settings.frontmatter)
						.onChange(async (value) => {
							this.plugin.settings.frontmatter = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl).setName("- 添加块id").addToggle((cd) =>
				cd
					.setValue(this.plugin.settings.blockId)
					.onChange(async (value) => {
						this.plugin.settings.blockId = value;
						await this.plugin.saveSettings();
					})
			);
		}
	}
}
