import { Editor, MarkdownView } from 'obsidian';
import { escapeStringForRegex } from 'src/helpers';
import Toolbox from 'src/main';
import Chat from './Chat';

const chat = new Chat(null);
let lastPrefix: string;
let timer: number;
let completionText = '';

export default function completionCommand(self: Toolbox) {
  self.addCommand({
    id: 'completion',
    name: self.settings.completion ? '关闭自动补全' : '开启自动补全',
    icon: 'pencil-line',
    callback: () => {
      self.settings.completion = !self.settings.completion;
      self.saveSettings();
      completionCommand(self);
    }
  });
}

export function completion(self: Toolbox): void {
  if (!self.settings.completion) return;
  const editor = self.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

  if (!editor) return;
  const { line, ch } = editor.getCursor();
  const text = editor.getLine(line);
  const prefix = text.slice(0, ch);
  const suffix = text.slice(ch);

  let match = suffix.match(new RegExp(`^%%${completionText}%%`, 'm'));
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
      chat.self = self;
      chat.FIMCompletion(prefix, suffix, self.settings.completionMaxLength, text => {
        const newCursor = editor.getCursor();
        const suffix = editor.getLine(editor.getCursor().line).slice(editor.getCursor().ch);
        const match = suffix.match(new RegExp(`%%${completionText}%%`, 'm'));
        if (newCursor.line === currentCursor.line && newCursor.ch === currentCursor.ch && text && !match) {
          completionText = escapeStringForRegex(text);
          editor.replaceRange(`%%${text}%%`, { line, ch });
        } else {
          completion(self);
        }
      });
    }, Math.max(self.settings.completionDelay, 100));
  }
}

function clearPlaceholder(editor: Editor): void {
  const content = editor.getValue();
  const hasPlaceholders = new RegExp(`%%${completionText}%%`, 'm').test(content);

  if (!hasPlaceholders) {
    return;
  }
  const cursorPos = editor.getCursor();
  const updatedContent = content.replace(new RegExp(`%%${completionText}%%`, 'm'), '');
  editor.setValue(updatedContent);

  editor.setCursor(cursorPos);
}
