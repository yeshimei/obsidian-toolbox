import { Notice } from 'obsidian';
import { pick } from 'src/helpers';
import Toolbox from 'src/main';

export default function passwordCreatorCommand(self: Toolbox) {
  self.settings.passwordCreator &&
    self.addCommand({
      id: '密码创建器',
      name: '密码创建器',
      icon: 'key-round',
      callback: () => passwordCreator(self)
    });
}

function passwordCreator(self: Toolbox) {
  if (!self.settings.passwordCreator) return;
  const pass = pick(self.settings.passwordCreatorMixedContent.split(''), self.settings.passwordCreatorLength).join('');
  window.navigator.clipboard.writeText(pass);
  new Notice('密码已复制至剪切板！');
}
