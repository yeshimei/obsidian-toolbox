import { TFile, Setting } from 'obsidian';
import { countOccurrences } from 'src/helpers';
import Toolbox from 'src/main';
import Block from './Block';

export default function switchLibrary(self: Toolbox) {
  if (!self.settings.switchLibrary) return;
  let name = '全部';
  Block.register('书库', (args, file) => {
    const files = self.app.vault.getMarkdownFiles().filter(file => self.hasReadingPage(file, false));
    const categories = files.map(file => self.getMetadata(file, 'category')).filter(Boolean);
    const categoryOccurrences = countOccurrences(categories);
    categoryOccurrences.unshift(['全部', files.length]);
    document.onclick = evt => {
      const target = evt.target as HTMLElement;
      if (target.hasClass('__library')) {
        name = target.dataset.name;
        Block.exec(self, file);
        evt.preventDefault();
        evt.stopPropagation();
      }
    };
    return categoryText(categoryOccurrences, name) + '\n\n' + dataviewJsContent(name);
  });
}

function categoryText(occurrences: [string, number][], name: string) {
  return occurrences
    .sort((a, b) => b[1] - a[1])
    .reduce((ret, res) => (ret += `<span class="__library" data-name="${res[0]}" data-count=${res[1]} style="background-color: ${name === res[0] ? 'var(--text-highlight-bg)' : 'unset'}">${res[0]}（${res[1]}）</span> | `), '')
    .slice(0, -2);
}

function dataviewJsContent(name: string) {
  return `\`\`\`dataview
table without id
	embed(link(cover)) as "封面" ,
	choice(top, "🔥", "") + choice(completionDate, "🏆", "") + "《[" + file.name + "](" + file.path + ")》" + author,
	 "[笔记](书库/读书笔记/" + file.name +")" + choice(relationshipDiagram, " / [人物关系](书库/人物关系/" + title +")", ""),
	choice(completionDate, "进度 100% <br>", choice(readingDate,choice(readingProgress, "进度 " + readingProgress + "% <br>", ""), "进度 未读<br>")) + choice(readingTimeFormat, "时长 "+ durationformat(dur(readingTimeFormat), "h'h'm'm's's'")+"<br>", "") + "讨论 " + dialogue + "<br>划线 " + highlights + "<br>想法 "  + thinks + "<br>出链 " + outlinks ,
	bookReview
from "书库" and #book
${name === '全部' ? '' : `where category="${name}"`}
sort top DESC, file.mtime DESC
\`\`\``;
}
