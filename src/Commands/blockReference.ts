import { Editor, Notice, TFile } from 'obsidian';
import { getBlock } from 'src/helpers';
import Toolbox from 'src/main';

export default function blockReferenceCommand(self: Toolbox) {
  self.settings.blockReference &&
    self.addCommand({
      id: '块引用',
      name: '块引用',
      icon: 'blocks',
      editorCallback: (editor, view) => blockReference(self, editor, view.file)
    });
}

function blockReference(self: Toolbox, editor: Editor, file: TFile) {
  if (!self.settings.blockReference) return;
  let blockId = getBlock(self.app, editor, file, true);
  let id = Array.isArray(blockId) ? blockId[0].trim() : '^' + blockId;
  let name = Array.isArray(blockId) ? blockId[0].trim() : file.basename;
  window.navigator.clipboard.writeText(`[[${file.path.replace('.' + file.extension, '')}#${id}|${name}]]`);
  new Notice('块引用已复制至剪切板！');
}
