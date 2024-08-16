import { Panel } from "./Panel";
import { Plugin, Editor, Notice, TFile, requestUrl } from "obsidian";
import {
	ToolboxSettings,
	DEFAULT_SETTINGS,
	ToolboxSettingTab,
} from "./settings";

export default class Toolbox extends Plugin {
	settings: ToolboxSettings;
	currentFile: TFile;
	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ToolboxSettingTab(this.app, this));
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				this.currentFile = file;
				this.polysemy(file);
			})
		);
		this.settings.passwordCreator &&
			this.addCommand({
				id: "密码创建器",
				name: "密码创建器",
				callback: () => this.passwordCreator(),
			});
		this.settings.footnoteRenumbering &&
			this.addCommand({
				id: "脚注重编号",
				name: "脚注重编号",
				callback: () => this.footnoteRenumbering(),
			});
		this.settings.searchForWords &&
			this.addCommand({
				id: "查词",
				icon: "search",
				name: "查词",
				editorCallback: (editor) => this.searchForWords(editor),
			});
	}

	async searchForWords(editor: Editor) {
		let word = editor.getSelection();
		const html = await this.requestUrlToHTML(
			"https://www.zdic.net/hans/" + word
		);
		const jnr = html.querySelector(".jnr");
		const pinyin = html.querySelector(".ciif .dicpy")?.textContent || "";

		new Panel(
			this.app,
			`${word} ${pinyin}`,
			jnr || "空空如也",
			"写生词",
			async () => {
				const meanings =
					this.removeDuplicates(
						Array.from(jnr.querySelectorAll(".cino, .encs")).map(
							(el) => el.parentNode.textContent
						)
					)
						.map((text) => this.filterChineseAndPunctuation(text))
						.map((text) => this.trimNonChineseChars(text))
						.map((text) => text.replace(";", "；"))
						.join("；") + "。";
				const content = `${word}\`/${pinyin}/\`：${meanings}`;
				const filepath =
					this.settings.searchForWordsSaveFolder + "/" + word + ".md";

				let file = this.app.vault.getFileByPath(filepath);
				if (file) {
					new Notice("生词已存在");
				} else {
					file = await this.app.vault.create(filepath, content);
				}
				editor.replaceSelection(`[[${word}]]`);
				this.app.workspace.getLeaf(true).openFile(file);
			}
		).open();
	}

	passwordCreator() {
		const pass = this.pick(
			this.settings.passwordCreatorMixedContent.split(""),
			this.settings.passwordCreatorLength
		).join("");
		window.navigator.clipboard.writeText(pass);
		new Notice("密码已复制至剪切板！");
	}

	async footnoteRenumbering() {
		let context = await this.app.vault.read(this.currentFile);

		let i1 = 1;
		let i2 = 1;

		context = context
			.replace(/\[\^(\d+)\][^:]/g, function (a) {
				return a.replace(/\d+/, String(i1++));
			})
			.replace(/\[\^(\d+)\]:/g, function (a) {
				return a.replace(/\d+/, String(i2++));
			});

		await this.app.vault.modify(this.currentFile, context);
		new Notice(`已为${i1 - 1}个脚注重新编号`);
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

			if (targetFile) {
				const LastOpenFiles = this.app.workspace.getLastOpenFiles();
				if (LastOpenFiles[1] !== file.path) {
					const view = this.app.workspace.getLeaf(true);
					view.openFile(targetFile);
					new Notice(
						`《${file.basename}》是一篇多义笔记，已转跳至《${filename}》 `
					);
				}
			}
		}
	}

	async requestUrlToHTML(url: string) {
		const content = await requestUrl(url);
		const div = document.createElement("div");
		div.innerHTML = content.text;
		return div;
	}

	filterChineseAndPunctuation(str: string) {
		const regex = /[\u4e00-\u9fa5。，、；;]/g;
		return str.match(regex).join("");
	}

	trimNonChineseChars(str: string) {
		return str.replace(/^[^\u4e00-\u9fa5]+|[^\u4e00-\u9fa5]+$/g, "");
	}

	removeDuplicates<T>(arr: T[]) {
		return arr.filter(
			(item: T, index: number) => arr.indexOf(item) === index
		);
	}

	pick<T>(arr: T[], n: number = 1, repeat = true): T[] {
		if (n >= arr.length) {
			return arr;
		}
		let result: T[] = [];
		let picked: Set<number> = new Set();
		for (let i = 0; i < n; i++) {
			let index = Math.floor(Math.random() * arr.length);
			if (!repeat) {
				while (picked.has(index)) {
					index = Math.floor(Math.random() * arr.length);
				}
				picked.add(index);
			}

			result.push(arr[index]);
		}
		return result;
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
