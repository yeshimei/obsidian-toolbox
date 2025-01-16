import { TFile } from 'obsidian';
import { vidoeSuffix } from 'src/helpers';
import Toolbox from 'src/main';
import InputBox from 'src/Modals/InputBox';

export default async function repositionVideo(self: Toolbox, file: TFile) {
  if (!file || file.extension !== 'md' || !self.settings.videoLinkFormat || !self.hasTag(file, 'videoLinkFormat')) return;
  const content = await self.app.vault.read(file);
  const videoLinkRegex = new RegExp(`!\\[\\[(.*?\\.${vidoeSuffix.join('|')})\\]\\]`, 'i');
  const videoLink = content.match(videoLinkRegex)?.[1];
  if (!videoLink) return;
  new InputBox(self.app, {
    title: videoLink,
    name: '外链',
    onSubmit: res => {
      const link = res.split('/?').shift();
      self.app.vault.modify(file, content.replace(`![[${videoLink}]]`, '').replace('[![[bilibili.png|15]]]', `[![[bilibili.png|15]]](${link}) [[${videoLink}|${videoLink.replace(/\..*?$/, '')}]]\n[![[bilibili.png|15]]]`));
    }
  }).open();
}
