import { MarkdownView } from 'obsidian';

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
