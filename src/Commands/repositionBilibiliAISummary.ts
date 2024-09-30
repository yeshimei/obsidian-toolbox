import { TFile } from 'obsidian';
import { escapeStringForRegex, hasRootFolder } from 'src/helpers';
import Toolbox from 'src/main';

export default async function repositionBilibiliAISummary(self: Toolbox, file: TFile) {
  if (!self.settings.bilibiliAISummaryFormat || !hasRootFolder(file, self.settings.bilibiliAISummaryFormatFolder)) return;
  let content = await self.app.vault.read(file);

  const url = content.match(/https:\/\/www.bilibili.com\/video\/[a-zA-Z0-9]+/)?.[0];

  if (!url) return;

  if (!new RegExp(`!\\[\\]\\(${escapeStringForRegex(url)}\\)`).test(content)) {
    content = content.replace(/(# .*)/, `$1\n\n![](${url})`);
    await self.app.vault.modify(file, content);
  }

  const timeRegex = /(?<minutes>\d{2}):(?<seconds>\d{2})[\s:-]*(?!\]\(|\))/g;
  if (!timeRegex.test(content)) return;
  content = content.replace(timeRegex, (...args) => {
    let { minutes, seconds } = args.pop();
    const time = Number(minutes) * 60 + Number(seconds);
    return `[${minutes}:${seconds}](${url}/?t=${time}#t=${minutes}:${seconds}) - `;
  });
  await self.app.vault.modify(file, content);
}
