import { Plugin, MarkdownView, Editor, Notice, TFile } from "obsidian";

import {
	ToolboxSettings,
	DEFAULT_SETTINGS,
	ToolboxSettingTab,
} from "./settings";
import { basename } from "path";

export default class Toolbox extends Plugin {
	timer: number;
	settings: ToolboxSettings;
	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ToolboxSettingTab(this.app, this));
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				this.polysemy(file);
			})
		);
		this.settings.passwordCreator &&
			this.addCommand({
				id: "密码创建器",
				name: "密码创建器",
				callback: () => this.passwordCreator(),
			});
	}

	passwordCreator() {
		const pass = this.pick(
			this.settings.passwordCreatorMixedContent.split(""),
			this.settings.passwordCreatorLength
		).join("");
		window.navigator.clipboard.writeText(pass);
		this.notice("密码已复制至剪切板！");
	}

	polysemy(file: TFile) {
		const to = this.app.metadataCache.getFileCache(file)?.frontmatter?.to;
		if (to) {
			let filename = to.match(/\[\[(.*)\]\]/)?.[1];
			let files = this.app.vault.getMarkdownFiles();

			let targetFile = files.find(
				({ basename, path, extension }) =>
					basename === filename ||
					path.replace("." + extension, "") === filename
			);
			console.log(targetFile);

			if (targetFile) {
				const LastOpenFiles = this.app.workspace.getLastOpenFiles();
				if (LastOpenFiles[1] !== file.path) {
					const view = this.app.workspace.getLeaf(true);
					view.openFile(targetFile);
					this.notice(
						`《${file.basename}》是一篇多义笔记，已转跳至《${filename}》 `
					);
				}
			}
		}
	}

	pick<T>(arr: T[], n: number = 1, repeat = false): T[] {
		if (n >= arr.length) {
			return arr;
		}
		let result: T[] = [];
		let picked: Set<number> = new Set();
		for (let i = 0; i < n; i++) {
			let index = Math.floor(Math.random() * arr.length);
			if (repeat) {
				while (picked.has(index)) {
					index = Math.floor(Math.random() * arr.length);
				}
				picked.add(index);
			}

			result.push(arr[index]);
		}
		return result;
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
