import { codeBlockParamParse, imageSuffix } from 'src/helpers';
import Toolbox from 'src/main';

export default function gallery(self: Toolbox) {
  if (!self.settings.gallery) return;
  self.registerMarkdownCodeBlockProcessor('t-gallery', (source, el, ctx) => {
    const { path } = codeBlockParamParse(source);
    if (path) {
      const files = self.app.vault
        .getFiles()
        .filter(file => new RegExp(`^${path}`).test(file.path))
        .filter(file => imageSuffix.includes(file.extension));
      const content = files.map(file => self.app.vault.adapter.getResourcePath(file.path)).reduce((res, ret) => (res += `<img alt="" src="${ret}">`), '');
      el.innerHTML = content;
    }
  });
}
