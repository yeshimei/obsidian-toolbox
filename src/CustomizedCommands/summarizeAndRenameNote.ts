import { Notice, TFile } from 'obsidian';
import { hasRootFolder } from 'src/helpers';
import Toolbox from 'src/main';
import inPrompts from '../Commands/AIChatInPrompt';
import Chat from '../Commands/chat';
const chat = new Chat(null);

export default async function summarizeAndRenameNote(self: Toolbox, file: TFile) {
  if (!file || file.extension !== 'md' || !self.settings.summarizeAndRenameNote || !self.settings.summarizeAndRenameNoteFolder.split(',').some(f => hasRootFolder(file, f))) return;
  chat.self = self;
  const title = self.getMetadata(file, 'title');
  const summary = self.getMetadata(file, 'summary');
  if (!summary) {
    const t = new Notice(`正在为笔记生成摘要`);
    await inPrompts.summarizeNote.fn(self, chat);
    t.hide();
    new Notice(`已为笔记生成摘要`);
  }

  if (!title) {
    const t = new Notice(`正在为笔记生成标题`);
    await inPrompts.namingTitle.fn(self, chat);
    t.hide();
    new Notice(`已为笔记生成标题`);
  }
}
