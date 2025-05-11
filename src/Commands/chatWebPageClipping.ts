import { App, Notice, TFile } from 'obsidian';
import Toolbox from 'src/main';
import inPrompts from './AIChatInPrompt';
import { getMetadata, isFileInDirectory } from 'src/helpers';
import AIChatManager from './AIChatManager';
const chat = new AIChatManager(null);

export default async function chatWebPageClipping(self: Toolbox, file: TFile) {
  const isMD = isFileInDirectory(file, self.settings.chatWebPageClippingFolder.split(','))
  if (!isMD) return;
  chat.self = self;
  let title = getMetadata(file, 'title') || '';
  let summary = getMetadata(file, 'summary') || '';
  let content = await self.app.vault.read(file);
  let t: Notice
  if (!content) return;
  if (!summary) {
    const tt = title ? title + '\n\n' : ''
    t = new Notice(`${tt}正在为笔记生成摘要`, 0);
    await inPrompts.summarizeNote.fn(self, chat, text => {
      summary += text
      t.setMessage(`${tt}${summary}`)
    });
  }

  if (!title) {
    if (!t) t = new Notice(`正在为笔记生成标题\n\n${summary}`, 0);
    else t.setMessage(`正在为笔记生成标题\n\n${summary}`);
    await inPrompts.namingTitle.fn(self, chat, text => {
      title += text
      t.setMessage(`${title}\n\n${summary}`);
    });
  }
}


