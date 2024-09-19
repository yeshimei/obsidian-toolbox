import { codeBlockParamParse, pick } from 'src/helpers';
import Toolbox from 'src/main';

export default function reviewOfReadingNote(self: Toolbox) {
  if (!self.settings.reviewOfReadingNotes) return;
  self.registerMarkdownCodeBlockProcessor('t-review', async (source, el, ctx) => {
    const { count } = codeBlockParamParse(source);

    if (count) {
      let highlights: string[] = [];
      const files = self.app.vault.getMarkdownFiles().filter(file => new RegExp(`^${self.settings.readingNotesToFolder}`).test(file.path));
      for (let file of files) {
        const highlight = (await self.app.vault.cachedRead(file)).match(/\[.+?\]\(.*\)/g) as any;
        if (highlight) highlights = highlights.concat(highlight.map((h: any) => ({ text: h, file })));
      }
      const content = pick(highlights, count, true).reduce((res, ret: any) => {
        const [a, b, c] = /\[(.*)\]\((.*)\)/g.exec(ret.text);
        res += `<div data-callout-metadata="" data-callout-fold="" data-callout="quote" class="callout"><div class="callout-title" dir="auto"><div class="callout-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-quote"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path></svg></div><div class="callout-title-inner"><a class="internal-link" data-href="${ret.file.path}" href="${ret.file.path}" target="_blank" rel="noopener">《${ret.file.basename}》</a> </div></div><div class="callout-content">
<p dir="auto"><a class="internal-link" data-href="${c}" href="${c}" target="_blank" rel="noopener">${b.slice(9)}</a></p>
</div></div>`;
        return res;
      }, '');
      el.innerHTML = content;
    }
  });
}
