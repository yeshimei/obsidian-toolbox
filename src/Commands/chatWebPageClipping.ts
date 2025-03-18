import { App, Notice, TFile } from 'obsidian';
import Toolbox from 'src/main';
import inPrompts from './AIChatInPrompt';
import Chat from './chat';
import { getMetadata, isFileInDirectory } from 'src/helpers';
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


