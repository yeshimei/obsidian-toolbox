import { TFile } from 'obsidian';
import { sanitizeFileName } from 'src/helpers';
import Toolbox from 'src/main';
import Chat from './Chat';

interface InPrompt {
  title: string;
  description: string;
  promptContent: string;
  actionName: string;
  fn: (self: Toolbox, chat: Chat, cd?: (text: string, type: string) => void) => Promise<void>;
}

const inPrompts: { [key: string]: InPrompt } = {
  summarizeNote: {
    title: '📝 总结笔记',
    description: '提取当前笔记的关键信息，生成简洁明了的摘要，并保存到笔记的 frontmatter 中。',
    promptContent: '专注于快速、准确地总结各类文章。适用于学术论文、新闻报道、博客文章等多种文本类型。提取关键信息，生成简洁明了的摘要，识别并突出文章的主要论点、结论和重要数据。支持多语言文本处理。熟悉多种学科领域的专业术语和概念。掌握信息提取和文本摘要的先进算法，了解不同类型文章的结构和写作风格。请使用一段话概括以下内容',
    actionName: 'notSaveChat',
    fn: summarizeNote
  },
  namingTitle: {
    title: '🎯 起标题',
    description: '为当前笔记快速生成吸引人的标题，并保存到笔记的 frontmatter 中。',
    promptContent: '根据文章内容快速生成吸引人的标题，理解文章的核心主题和关键信息，尽量保持简短，不允许出现以下特殊符号 * "  / < > : | ?',
    actionName: 'notSaveChat',
    fn: namingTitle
  }
};

export default inPrompts;

async function summarizeNote(self: Toolbox, chat: Chat, cd?: (text: string, type: string) => void) {
  await startChat('summarizeNote', self, chat, cd, (file: TFile, t: string) => {
    self.updateFrontmatter(file, 'summary', t.replace(/\n/g, ' '));
  });
}

async function namingTitle(self: Toolbox, chat: Chat, cd?: (text: string, type: string) => void) {
  await startChat('namingTitle', self, chat, cd, async (file: TFile, t: string) => {
    const filename = sanitizeFileName(t);
    await self.updateFrontmatter(file, 'title', filename);
    await self.app.fileManager.renameFile(file, file.path.replace(new RegExp(`(${file.basename}).md`, 'g'), `${filename}.md`));
  });
}

async function startChat(name: string, self: Toolbox, chat: Chat, c2: (text: string, type: string) => void, c1: (file: TFile, t: string) => void): Promise<void> {
  const { promptContent } = inPrompts[name];
  const file = self.app.workspace.getActiveFile();
  if (!file) return;
  let content = await self.app.vault.cachedRead(file);
  if (!content) return;
  let t = '';
  chat.clearMessage();
  chat.data.save = false;
  await chat.openChat(
    [
      { role: 'system', content: promptContent, type: 'prompt' },
      { role: 'user', content: content, type: 'file' }
    ],
    (text: string, type: string) => {
      if (type === 'content') {
        c2 && c2(text, type);
        t += text;
        if (!text) {
          c1(file, t);
        }
      }
    }
  );
}
