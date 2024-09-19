import { TFile } from 'obsidian';
import Toolbox from 'src/main';
import InputBox from 'src/Modals/InputBox';

export default async function repositionVideo(self: Toolbox, file: TFile) {
  if (!self.settings.videoLinkFormat || file.path !== self.settings.videoLinkFormatFolder + '.md') return;
  const content = await self.app.vault.read(file);
  const videoLinkRegex = /\[\[(.*?\.(mp4|mkv|avi|mov|wmv|flv|webm))\]\]/g;
  let match;

  while ((match = videoLinkRegex.exec(content)) !== null) {
    const videoLink = match[1];
    new InputBox(self.app, {
      title: videoLink,
      name: '外链',
      onSubmit: res => {
        const link = res.split('/?').shift();
        self.app.vault.modify(file, content.replace(`![[${videoLink}]]`, '').replace('[![[bilibili.png|15]]]', `[![[bilibili.png|15]]](${link}) [[${videoLink}|${videoLink.replace(/\..*?$/, '')}]]\n[![[bilibili.png|15]]]`));
      }
    }).open();
  }
}
