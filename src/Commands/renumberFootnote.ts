import { Notice, TFile } from 'obsidian';
import Toolbox from 'src/main';

export default function renumberFootnoteCommand(self: Toolbox) {
  self.settings.footnoteRenumbering &&
    self.addCommand({
      id: '脚注重编号',
      name: '脚注重编号',
      icon: 'footprints',
      editorCallback: async (editor, view) => renumberFootnote(self, view.file)
    });
}

export async function renumberFootnote(self: Toolbox, file: TFile) {
  if (!self.settings.footnoteRenumbering) return;
  let content = await self.app.vault.read(file);
  let footnoteIndex = 1;
  let referenceIndex = 1;
  // 重新编号脚注引用
  content = content.replace(/\[\^(\d+)\][^:]/g, () => `[^${footnoteIndex++}]`);
  // 重新编号脚注定义
  content = content.replace(/\[\^(\d+)\]:/g, () => `[^${referenceIndex++}]:`);
  await self.app.vault.modify(file, content);
  new Notice(`已为${footnoteIndex - 1}个脚注重新编号`);
}