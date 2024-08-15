import { Plugin, MarkdownView, Editor, Notice, TFile } from "obsidian";

import {
	ToolboxSettings,
	DEFAULT_SETTINGS,
	ToolboxSettingTab,
} from "./settings";

export default class Toolbox extends Plugin {
	timer: number;
	settings: ToolboxSettings;
	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ToolboxSettingTab(this.app, this));
	}

	notice(text: string) {
		new Notice(text);
	}

	openFile(path: string) {
		return this.app.vault.getAbstractFileByPath(path) as TFile;
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
