import { Notice, TFile } from 'obsidian';
import Toolbox from 'src/main';

export default function polysemy(self: Toolbox, file: TFile) {
  if (!self.settings.polysemy) return;
  const to = self.getMetadata(file, 'to');
  if (!to) return;
  let filename = to.match(/\[\[(.*)\]\]/)?.[1];
  if (!filename) return;
  let targetFile = self.getFileByShort(filename);
  if (!targetFile) return;
  const LastOpenFiles = self.app.workspace.getLastOpenFiles();
  if (LastOpenFiles[1] === file.path) return;
  const view = self.app.workspace.getLeaf(true);
  view.openFile(targetFile);
  new Notice(`《${file.basename}》是一篇多义笔记，已转跳至《${filename}》 `);
}
