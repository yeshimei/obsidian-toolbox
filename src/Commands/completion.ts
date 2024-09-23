import { Editor, MarkdownView } from 'obsidian';
import Toolbox from 'src/main';
import { Chat } from './chat';

let lastPrefix: string;

let timer: number;

export function completion(self: Toolbox): void {
  if (!self.settings.completion) return;
  const editor = self.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

  if (!editor) return;
  const { line, ch } = editor.getCursor();
  const text = editor.getLine(line);
  const prefix = text.slice(0, ch);
  const suffix = text.slice(ch);

  let match = suffix.match(/^%%[\s\S]*?%%/);
  document.onkeydown = evt => {
    if (evt.key === ' ') {
      if (match && match[1] !== undefined) {
        evt.preventDefault();
        evt.stopPropagation();
        const matchIndex = match.index || 0;
        const content = match[1];
        editor.replaceRange(content, { line, ch: ch + matchIndex }, { line, ch: ch + matchIndex + match[0].length });
        const newPos = { line, ch: ch + matchIndex + content.length };
        editor.setCursor(newPos);
      }
    }
  };

  document.onclick = evt => {
    const target = evt.target as HTMLElement;
    if (target.hasClass('cm-comment')) {
      evt.preventDefault();
      evt.stopPropagation();
      const matchIndex = match.index || 0;
      const content = match[1];
      editor.replaceRange(content, { line, ch: ch + matchIndex }, { line, ch: ch + matchIndex + match[0].length });
      const newPos = { line, ch: ch + matchIndex + content.length };
      editor.setCursor(newPos);
    }
  };

  if (!match || (match && lastPrefix !== prefix)) {
    clearPlaceholder(editor);
  }

  lastPrefix = prefix;
  match = suffix.match(/^%%([\s\S]*?)%%/);
  if (!match) {
    if (timer) clearTimeout(timer);
    const currentCursor = editor.getCursor();
    timer = window.setTimeout(() => {
      let chat = new Chat(self);
      chat.FIMCompletion(prefix, suffix, self.settings.completionMaxLength, text => {
        const newCursor = editor.getCursor();
        if (newCursor.line === currentCursor.line && newCursor.ch === currentCursor.ch && text) {
          editor.replaceRange(`%%${text}%%`, { line, ch });
        } else {
          completion(self);
        }
      });
    }, Math.max(self.settings.completionDelay, 300));
  }
}

function clearPlaceholder(editor: Editor): void {
  const content = editor.getValue();
  const hasPlaceholders = /%%[\s\S]*?%%/.test(content);

  if (!hasPlaceholders) {
    return;
  }
  const cursorPos = editor.getCursor();
  const updatedContent = content.replace(/%%[\s\S]*?%%/g, '');
  editor.setValue(updatedContent);

  editor.setCursor(cursorPos);
}
