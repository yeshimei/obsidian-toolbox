import { Editor, TFile } from 'obsidian';
import { getBlock, today } from 'src/helpers';
import Toolbox from 'src/main';
import PanelHighlight from 'src/Modals/PanelHighlight';

export default function highlightCommand(self: Toolbox) {
  self.settings.highlight &&
    self.addCommand({
      id: '划线',
      name: '划线',
      icon: 'brush',
      editorCallback: (editor, view) => highlight(self, editor, view.file)
    });
}

function highlight(self: Toolbox, editor: Editor, file: TFile) {
  const onSubmit = (res: string, tagging: string) => {
    let blockId = getBlock(editor);
    res = `<span class="__comment cm-highlight" style="white-space: pre-wrap;" data-comment="${res || ''}" data-id="${blockId}" data-tagging="${tagging || ''}" data-date="${today(true)}">${text}</span>`;
    editor.replaceSelection(res);
  };

  if (!self.settings.highlight) return;
  let text = editor.getSelection();
  new PanelHighlight(self.app, text, onSubmit).open();
}
