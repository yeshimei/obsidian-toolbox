import { Plugin, Notice, TFile, MarkdownView, htmlToMarkdown, request, Platform } from 'obsidian';
import { ToolboxSettings, DEFAULT_SETTINGS, ToolboxSettingTab } from './settings';
import { createElement, msTo, today, debounce, $, editorBlur, SOURCE_VIEW_CLASS, MOBILE_HEADER_CLASS, MOBILE_NAVBAR_CLASS } from './helpers';
import { PanelExhibition } from './Modals/PanelExhibition';
import { clearNotePass, decryptPopUpCommand, encOrDecPopUp, encryptPopUpCommand, toggleEncryptNote } from './Commands/encryption';
import test from 'test/Test';
import 'test';
import poster from './Commands/poster';
import gallery from './Commands/gallery';
import reviewOfReadingNote from './Commands/reviewOfReadingNote';
import polysemy from './Commands/polysemy';
import flipCommand, { readingPageMask } from './Commands/flip';
import blockReferenceCommand from './Commands/blockReference';
import highlightCommand from './Commands/highlight';
import passwordCreatorCommand from './Commands/passwordCreator';
import clipboardFormatCommand from './Commands/clipboardFormat';
import renumberFootnoteCommand from './Commands/renumberFootnote';
import resourcesToCommand, { resourceTo } from './Commands/resourceTo';
import dialogueCommand from './Commands/dialogue';
import searchForPlantCommand from './Commands/searchForPlant';
import searchForWordCommand from './Commands/searchForWord';
import createCharacterRelationshipCommand, { toggleCharacterRelationship } from './Commands/createCharacterRelationship';
import repositionVideo from './Commands/repositionVideo';
import adjustReadingPageStyle from './Commands/adjustReadingPageStyle';
import readingDataTracking from './Commands/readingDataTracking';
import init from './Commands/init';
import asyncNoteCommand from './Commands/syncNote';

export default class Toolbox extends Plugin {
  encryptionTempData: any;
  debounceReadDataTracking: Function;
  settings: ToolboxSettings;
  startTime: number;
  async onload() {
    this.encryptionTempData = {};
    await this.loadSettings();
    this.debounceReadDataTracking = debounce(readingDataTracking, this.settings.readDataTrackingDelayTime);
    this.addSettingTab(new ToolboxSettingTab(this.app, this));
    // 阅读功能仅允许在移动端使用
    init(this);
    // 画廊
    gallery(this);
    // 读书笔记回顾
    reviewOfReadingNote(this);
    // 将视频第一帧作为海报
    poster(this, document.body);
    // 翻页
    flipCommand(this);
    // 划线
    highlightCommand(this);
    // 讨论
    dialogueCommand(this);
    // 人物关系
    createCharacterRelationshipCommand(this);
    // 查词
    searchForWordCommand(this);
    // 同步读书笔记
    asyncNoteCommand(this);
    // 加密笔记
    encryptPopUpCommand(this);
    // 解密笔记
    decryptPopUpCommand(this);
    // 密码创建器
    passwordCreatorCommand(this);
    // 剪切板文本格式化
    clipboardFormatCommand(this);
    // 脚注重编号
    renumberFootnoteCommand(this);
    // 块引用
    blockReferenceCommand(this);
    // 移动当前笔记中的资源至指定文件夹
    resourcesToCommand(this);
    // 查植物
    searchForPlantCommand(this);

    this.registerEvent(
      this.app.workspace.on('file-open', async file => {
        // document.body.onclick = evt => new Notice((evt.target as HTMLLIElement).className);
        this.startTime = Date.now();
        const sourceView = $(SOURCE_VIEW_CLASS);
        // 多义笔记转跳
        polysemy(this, file);
        // 阅读页面
        adjustReadingPageStyle(this, sourceView, file);
        // 阅读页面遮罩层
        readingPageMask(this, sourceView, file);
        // 自动弹出解密或解密输入框
        encOrDecPopUp(this, file);
        // 加密笔记后隐藏其内容，防止意外改动
        toggleEncryptNote(this, file);
        // 根据记住密码的行为判断是否清空本地存储的笔记密码
        clearNotePass(this);
        // 切换人物关系视图
        toggleCharacterRelationship(this, file);
      })
    );

    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        const sourceView = $(SOURCE_VIEW_CLASS);
        const file = this.getView()?.file;
        if (!file) return;
        adjustReadingPageStyle(this, sourceView, file);
        readingPageMask(this, sourceView, file);
        toggleEncryptNote(this, file);
      })
    );

    this.registerEvent(
      this.app.vault.on('modify', f => {
        const file = f as TFile;
        resourceTo(this, file, null);
        // 当笔记插入视频时重排版
        repositionVideo(this, file);
      })
    );

    this.addCommand({
      id: '单元测试',
      name: '单元测试',
      icon: 'clipboard-check',
      callback: () => this.test()
    });
  }

  updateFrontmatter(file: TFile, key: string, value: string | number) {
    this.app.fileManager.processFrontMatter(file, frontmatter => {
      frontmatter[key] = value;
    });
  }

  updateMetadata(file: TFile, outlinks: number, highlights: number, thinks: number, dialogue: number) {
    this.updateFrontmatter(file, 'outlinks', outlinks);
    this.updateFrontmatter(file, 'highlights', highlights);
    this.updateFrontmatter(file, 'thinks', thinks);
    this.updateFrontmatter(file, 'dialogue', dialogue);
  }

  getView() {
    return this.app.workspace.getActiveViewOfType(MarkdownView);
  }

  getEditor() {
    return this.getView()?.editor;
  }

  getFileByShort(filename: string) {
    return this.app.vault.getMarkdownFiles().find(({ basename, path, extension }) => basename === filename || path.replace('.' + extension, '') === filename);
  }

  getMetadata(file: TFile, key: string) {
    return file && this.app.metadataCache.getFileCache(file)?.frontmatter?.[key];
  }

  hasReadingPage(file: TFile) {
    return file && file.extension === 'md' && this.hasTag(file, 'book') && this.hasRootFolder(file, this.settings.readDataTrackingFolder) && this.getView().getMode() === 'source';
  }

  hasRootFolder(file: TFile, folderName: string) {
    return new RegExp(`^${folderName}`).test(file.path);
  }

  hasTag(file: TFile, name: string) {
    let tags = this.app.metadataCache.getFileCache(file)?.frontmatter?.tags || [];
    Array.isArray(tags) || (tags = [tags]);
    return tags.includes(name);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async test() {
    await test.run(this);
  }
}
