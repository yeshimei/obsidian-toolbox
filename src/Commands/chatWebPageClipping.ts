import { App, Notice, TFile } from 'obsidian';
import Toolbox from 'src/main';
import inPrompts from './AIChatInPrompt';
import Chat from './chat';
const chat = new Chat(null);

export default async function chatWebPageClipping(self: Toolbox, file: TFile) {
  const isMD = isFileInDirectory(file, self.settings.chatWebPageClippingFolder.split(','))
  if (!isMD) return;
  chat.self = self;
  let title = getMetadata(file, 'title') || '';
  let summary = getMetadata(file, 'summary') || '';
  let content = await self.app.vault.read(file);
  if (!content) return;
  if (!summary) {
    const t = new Notice(`正在为笔记生成摘要`);
    await inPrompts.summarizeNote.fn(self, chat, text => summary += text);
    t.hide();
    new Notice(`已为笔记生成摘要`);
  }

  if (!title) {
    const t = new Notice(`正在为笔记生成标题`);
    await inPrompts.namingTitle.fn(self, chat, text => title += text);
    t.hide();
    new Notice(`已为笔记生成标题`);
  }
}


function isFileInDirectory (file: TFile, directoryPath: string | string[]): boolean {
  if (!Array.isArray(directoryPath)) directoryPath = [directoryPath];
  return directoryPath.some(p => file && file.extension === 'md' && file.parent.path === p.trim());
}

function getMetadata(file: TFile, key: string) {
  return file && this.app.metadataCache.getFileCache(file)?.frontmatter?.[key];
}


async function appendAfterYaml(file: TFile, newText: string, app: App) {
    let content = await app.vault.read(file);
    // 匹配YAML frontmatter，考虑不同换行符
    const yamlRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
    const match = content.match(yamlRegex);
    
    let newContent: string;

    if (match) {
        // 存在YAML块
        const yamlEnd = match[0].length;
        // 插入新内容，前后添加换行确保格式
        newContent = 
            content.substring(0, yamlEnd) + 
            '\n' + newText + '\n' + 
            content.substring(yamlEnd);
    } else {
        // 无YAML块，插入到文件头部
        newContent = newText + '\n\n' + content;
    }
    
    await app.vault.modify(file, newContent);
}