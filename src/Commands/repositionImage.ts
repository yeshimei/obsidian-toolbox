import { TFile } from 'obsidian';
import { imageSuffix } from 'src/helpers';
import Toolbox from 'src/main';

export default async function repositionImage(self: Toolbox, file: TFile) {
  if (!self.settings.imageLinkFormat || !self.hasTag(file, 'imageLinkFormat')) return;
  let content = await self.app.vault.read(file);
  const imageLinkRegex = new RegExp(`!\\[\\[(.*?\\.(${imageSuffix.join('|')}))\\]\\]`, 'i');
  const iamgeLink = content.match(imageLinkRegex)?.[1];
  if (!iamgeLink) return;
  const caption = await navigator.clipboard.readText();
  content = content.replace(`![[${iamgeLink}]]`, '') + `\n\n![[${iamgeLink}|${caption}]]\n\n`;
  content = content.replace(/(!\[\[.*?\]\])[\n\s]+/g, '$1\n\n');

  await self.app.vault.modify(file, content);
}
