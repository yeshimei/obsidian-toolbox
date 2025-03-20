import { MarkdownView, Notice, TFile } from 'obsidian';
import { isFileInDirectory } from 'src/helpers';

const actions = [
  {
    value: '默认 😽',
    text: {
      name: 'default',
      icon: 'cat',
      fn: () => {}
    }
  },
  {
    value: '不保存当前对话 🗑️',
    text: {
      name: 'notSaveChat',
      icon: 'trash',
      fn: notSaveChat
    }
  },
  {
    value: '选中文本替换为第一个回答 ✏️',
    text: {
      name: 'replace',
      icon: 'pencil-line',
      fn: replace
    }
  },
  {
    value: '选中文本替换为 wiki 链接（整个对话） 🔗',
    text: {
      name: 'wikiLink',
      icon: 'link',
      fn: wikiLink
    }
  },
  {
    value: '生成一张卡片笔记 📇',
    text: {
      name: 'cardNote',
      icon: 'notepad-text',
      fn: cardNote
    }
  }
];

export default actions;

function replace() {
  const content = this.chat.messages.find((message: { type: string }) => message.type === 'answer');
  const editor = this.self.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
  if (editor) {
    const text = editor.getSelection();
    if (text) {
      editor.replaceSelection(content.content);
    }
  }
}

function wikiLink() {
  const editor = this.self.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
  if (editor) {
    const text = editor.getSelection();
    if (text) {
      editor.replaceSelection(`[[${this.chat.saveChatFile.path}|${text}]]`);
    }
  }
}

function notSaveChat() {
  this.chat.stopChat();
  this.chat.saveChatFile && this.self.app.vault.delete(this.chat.saveChatFile);
}


async function cardNote() {
  const editor = this.self.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
  const name = this.chat.messages.find((message: { type: string }) => message.type === 'question').content;
  const content = this.chat.messages.find((message: { type: string }) => message.type === 'answer').content;
  const folder = this.self.settings.cardSaveFolder;
  let file = this.self.app.vault.getMarkdownFiles().find((file: TFile) => isFileInDirectory(file, folder) && file.basename === name);
  
  if (file) {
    new Notice('卡片笔记已存在');
  } else {
    const filepath = `${folder}/${name}.md`;
    file = await this.self.app.vault.create(filepath, content || '');
  }
  if (editor && file) {
    const text = editor.getSelection();
    text && editor.replaceSelection(`[[${file.path.slice(0, -3)}|${text}]]`);
  }
  this.self.app.workspace.getLeaf(true).openFile(file);
}