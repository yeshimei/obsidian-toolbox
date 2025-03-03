import { Notice, TFile } from 'obsidian';
import Toolbox from 'src/main';
import FuzzySuggest from 'src/Modals/FuzzySuggest';

export default function resourcesToCommand(self: Toolbox) {
  self.settings.resourceTo &&
    self.addCommand({
      id: '移动当前笔记中的资源至指定文件夹',
      name: '移动当前笔记中的资源至指定文件夹',
      icon: 'clipboard-check',
      editorCallback: (editor, { file }) => {
        if (!self.settings.resourceTo) return;
        new FuzzySuggest(
          self.app,
          self.app.vault.getAllFolders().map(folder => ({ text: folder.path, value: folder.path })),
          ({ value }, evt) => resourceTo(self, file, value)
        ).open();
      }
    });
}

export async function resourceTo(self: Toolbox, file: TFile, targetFolder: string) {
  targetFolder = targetFolder || self.getMetadata(file, 'moveResourcesTo');
  if (!file || file.extension !== 'md' || !self.settings.resourceTo || !targetFolder) return;
  let content = await self.app.vault.read(file);
  const paths = Object.keys(self.app.metadataCache.resolvedLinks[file.path])
    .filter(path => path.indexOf(targetFolder) === -1)
    .map(path => {
      const targetPath = targetFolder + '/' + self.app.vault.getFiles().find(f => f.path === path).name;
      content = content.replace(path, targetPath);
      self.app.vault.adapter.rename(path, targetPath);
    });

  self.app.vault.modify(file, content);
  paths.length && new Notice(`已移动 ${paths.length} 至 ${targetFolder}`);
}
