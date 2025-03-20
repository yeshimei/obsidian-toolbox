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
  let content 
  let blockId = getBlock(self.app, editor, file, true);
  if (Array.isArray(blockId)) {
    const [link, text, tags] = blockId
    tags.unshift('')
    content = `[[${file.path.replace('.' + file.extension, '')}#${link.trim()}|${text.trim()}]]${tags.join(' #')}`
  } else {
    content = `[[${file.path.replace('.' + file.extension, '')}#^${blockId}|${file.basename.trim()}]]`
  }
  window.navigator.clipboard.writeText(content);
  new Notice('块引用已复制至剪切板！');
}

