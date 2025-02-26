import { MarkdownView, Plugin, TFile } from 'obsidian';
import 'test';
import test from 'test/Test';
import adjustReadingPageStyle from './Commands/adjustReadingPageStyle';
import chatCommand from './Commands/AIChat';
import Block from './Commands/Block';
import blockReferenceCommand from './Commands/blockReference';
import completionCommand, { completion } from './Commands/completion';
import createCharacterRelationshipCommand, { switchCharacterRelationship } from './Commands/createCharacterRelationship';
import dialogueCommand from './Commands/dialogue';
import { clearNotePass, decryptPopUpCommand, encOrDecPopUp, encryptPopUpCommand, toggleEncryptNote } from './Commands/encryption';
import flipCommand, { readingPageMask } from './Commands/flip';
import gallery from './Commands/gallery';
import highlightCommand from './Commands/highlight';
import passwordCreatorCommand from './Commands/passwordCreator';
import polysemy from './Commands/polysemy';
import poster from './Commands/poster';
import readingDataTracking from './Commands/readingDataTracking';
import relationshipDiagramCommand from './Commands/relationshipDiagram';
import renumberFootnoteCommand from './Commands/renumberFootnote';
import reviewOfReadingNote from './Commands/reviewOfReadingNote';
import searchForWordCommand from './Commands/searchForWord';
import asyncNoteCommand from './Commands/syncNote';
import repositionBilibiliAISummary from './CustomizedCommands/repositionBilibiliAISummary';
import repositionVideo from './CustomizedCommands/repositionVideo';
import resourcesToCommand, { resourceTo } from './CustomizedCommands/resourceTo';
import searchForPlantCommand from './CustomizedCommands/searchForPlant';
import summarizeAndRenameNote from './CustomizedCommands/summarizeAndRenameNote';
import switchLibrary from './CustomizedCommands/switchLibrary';
import { $, debounce, hasRootFolder, SOURCE_VIEW_CLASS } from './helpers';
import { DEFAULT_SETTINGS, ToolboxSettings, ToolboxSettingTab } from './settings';

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
    // 脚注重编号
    renumberFootnoteCommand(this);
    // 块引用
    blockReferenceCommand(this);
    // 移动当前笔记中的资源至指定文件夹
    resourcesToCommand(this);
    // 查植物
    searchForPlantCommand(this);
    // 切换书库
    switchLibrary(this);
    // ai 聊天
    chatCommand(this);
    // 自动补全
    completionCommand(this);
    // 打开关系图
    relationshipDiagramCommand(this);

    this.registerEvent(
      this.app.workspace.on('file-open', async file => {
        // document.body.onclick = evt => new Notice((evt.target as HTMLLIElement).className);
        this.startTime = Date.now();
        const sourceView = $(SOURCE_VIEW_CLASS);
        // Block
        Block.exec(this, file);
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
        switchCharacterRelationship(this, file);
        // 为笔记生成标题和摘要
        summarizeAndRenameNote(this, file);
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
        // 为哔哩哔哩AI视频总结笔记加入时间转跳
        repositionBilibiliAISummary(this, file);
      })
    );

    this.registerEvent(
      this.app.workspace.on('editor-change', () => {
        // 补全
        completion(this);
      })
    );

    // this.addCommand({
    //   id: '单元测试',
    //   name: '单元测试',
    //   icon: 'clipboard-check',
    //   callback: () => this.test()
    // });
  }

  async updateFrontmatter(file: TFile, key: string, value: string | number) {
    await this.app.fileManager.processFrontMatter(file, frontmatter => {
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
    if (!filename) return;
    return this.app.vault.getMarkdownFiles().find(({ basename, path, extension }) => path === filename || path === filename + '.' + extension || basename === filename || basename === filename + '.' + extension);
  }

  getMetadata(file: TFile, key: string) {
    return file && this.app.metadataCache.getFileCache(file)?.frontmatter?.[key];
  }

  hasReadingPage(file: TFile, mode = true) {
    return file && file.extension === 'md' && this.hasTag(file, 'book') && hasRootFolder(file, this.settings.readDataTrackingFolder) && (mode ? this.getView().getMode() === 'source' : true);
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
