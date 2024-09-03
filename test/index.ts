import Toolbox from 'src/main';
import './Helpers.test';
import './commonds/Encryption.test';
import { TFolder } from 'obsidian';

const root = 'test';
export async function create(self: Toolbox, filename: string, content: string) {
  const path = `${root}/${filename}.md`;
  await self.app.vault.adapter.write(path, content);
  return self.app.vault.getFileByPath(path);
}

export async function remove(self: Toolbox, files: any) {
  if (!Array.isArray(files)) files = [files];
  for (let file of files) {
    if (typeof file === 'string') {
      await self.app.vault.adapter.remove(file);
    } else {
      await self.app.vault.delete(file);
    }
  }
}

export async function clearRootFFolder(self: Toolbox) {
  const folder = this.app.vault.getAbstractFileByPath(root);
  if (folder && folder instanceof TFolder) {
    await this.app.vault.delete(folder, true);
  }
  await this.app.vault.createFolder(root);
}
