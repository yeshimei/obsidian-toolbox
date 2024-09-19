import { Editor } from 'obsidian';
import { generateId } from 'src/helpers';
import Toolbox from 'src/main';
import DoubleInputBox from 'src/Modals/DoubleInputBox';

export default function dialogueCommand(self: Toolbox) {
  self.settings.dialogue &&
    self.addCommand({
      id: '讨论',
      name: '讨论',
      icon: 'bell-ring',
      editorCallback: editor => dialogue(self, editor)
    });
}

function dialogue(self: Toolbox, editor: Editor) {
  const onSubmit = (title: string, text: string) => {
    let blockId = generateId();
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const newText = `\n\n==dialogue==\n\n${title || '---'} ^${blockId}\n\n${text}\n\n==dialogue==`;

    editor.replaceRange(newText, { line: cursor.line, ch: line.length });
  };

  if (!self.settings.dialogue) return;
  new DoubleInputBox(self.app, {
    title: '讨论',
    titleName: '标题',
    textName: '内容',
    onSubmit
  }).open();
}
