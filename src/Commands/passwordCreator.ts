import { Notice } from 'obsidian';
import { isNoteEncrypt, pick } from 'src/helpers';
import Toolbox from 'src/main';
import DoubleInputBox from 'src/Modals/DoubleInputBox';

export default function passwordCreatorCommand(self: Toolbox) {
  self.settings.passwordCreator &&
    self.addCommand({
      id: '密码创建器',
      name: '密码创建器',
      icon: 'key-round',
      callback: () => passwordCreator(self)
    });
}

async function passwordCreator(self: Toolbox) {
  if (!self.settings.passwordCreator) return;
  const pass = pick(self.settings.passwordCreatorMixedContent.split(''), self.settings.passwordCreatorLength).join('');
  await savePassword(self, pass);
  window.navigator.clipboard.writeText(pass);
  new Notice('密码已复制至剪切板！');
}

async function savePassword(self: Toolbox, pass: string) {
  if (!self.settings.savePass) return;
  const path = self.settings.savePassPath + '.md';
  const file = self.app.vault.getFileByPath(path);
  let content = await self.app.vault.read(file);
  const currentFile = self.app.workspace.getActiveFile();

  if (currentFile && currentFile.path !== path) {
    self.app.workspace.getLeaf(true).openFile(file);
  }

  if (isNoteEncrypt(content)) return new Notice('请先解密后再保存密码！');

  const tableLastLineRegex = /(\|.*\|\s*)$/g;
  if (tableLastLineRegex.test(content)) {
    new DoubleInputBox(self.app, {
      title: '保存密码',
      titleName: '站点名称',
      textName: '账号',
      onSubmit: async (res1: string, res2: string) => {
        content = content.replace(tableLastLineRegex, `$1| ${res1} | ${res2} | ${pass} | `);
        await self.app.vault.modify(file, content);
      }
    }).open();
  }
}
