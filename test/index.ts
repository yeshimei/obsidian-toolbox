import Toolbox from 'src/main';
// import './Helpers.test';
// import './commands/Encryption.test';
import { arrayBufferToBase64, TFolder } from 'obsidian';

const root = 'test';
export async function create(self: Toolbox, filename: string, content: string) {
  const path = `${root}/${filename}.md`;
  await self.app.vault.adapter.write(path, content);
  return self.app.vault.getFiles().find(f => f.path === path)
}

export async function clearRootFFolder(self: Toolbox) {
  const folder = this.app.vault.getAbstractFileByPath(root);
  if (folder && folder instanceof TFolder) {
    await this.app.vault.delete(folder, true);
  }
  await this.app.vault.createFolder(root);
}

export async function readBinaryToString(self: Toolbox, path: string) {
  return new TextDecoder().decode(await self.app.vault.adapter.readBinary(path));
}

export async function readBinaryToBase64(self: Toolbox, path: string) {
  return arrayBufferToBase64(await self.app.vault.adapter.readBinary(path));
}
