import { md5 } from 'js-md5';
import { Notice, TFile } from 'obsidian';
import { uniqueBy } from 'src/helpers';
import Toolbox from 'src/main';

export default function asyncNoteCommand(self: Toolbox) {
  self.settings.readingNotes &&
    self.addCommand({
      id: '同步读书笔记',
      name: '同步读书笔记',
      icon: 'activity',
      callback: () =>
        self.app.vault
          .getMarkdownFiles()
          .filter(file => self.hasReadingPage(file))
          .forEach(file => syncNote(self, file))
    });
}

export async function syncNote(self: Toolbox, file: TFile) {
  if (!self.settings.readingNotes) return;
  let markdown = await self.app.vault.read(file);
  let highlights = 0;
  let thinks = 0;
  let outlinks = 0;
  let dialogue = 0;

  let { links, frontmatter } = self.app.metadataCache.getFileCache(file);
  console.log('🚀 ~ syncNote ~ links:', links);
  let content = '---\ntags: 读书笔记\n---';
  // 出链

  if (self.settings.outLink && links) {
    content += '\n\n# 出链\n\n';
    links = uniqueBy(links, (link: any) => link.link)
      .filter(link => self.app.vault.getMarkdownFiles().some(file => [`词语/${link.link}.md`, `卡片盒/${link.link}.md`, `卡片盒/归档/${link.link}.md`].some(path => file.path.includes(path))))
      .map(({ link }) => (content += `[[${link}|${link.split('/').pop()}]] / `));
    links.length && (content = content.slice(0, -3));
    outlinks = links.length;
  }

  // 书评
  let { bookReview } = frontmatter;
  bookReview && (content += `\n\n# 书评 \n\n > [!tip] ${bookReview}${self.settings.blockId ? ' ^' + md5(bookReview) : ''}`);

  // 讨论
  const d = (markdown.match(/==dialogue==[\s\S]*?==dialogue==/g) || [])
    .reverse()
    .map(t => t.replace(/==dialogue==/g, ''))
    .map(t => {
      const c = t.split('\n');
      const [title, id] = c[2].split('^');
      c[2] = `## [${title}](${file.path}#^${id})`;
      return c.slice(0, -2).join('\n');
    });

  if (d.length) {
    dialogue = d.length;
    content +=
      '\n\n# 讨论' +
      d.reduce((res, ret) => {
        ret += res;
        return ret;
      }, '');
  }

  // 划线
  const t = (markdown.match(/<span class="__comment[\S\s]+?<\/span>|#{1,6} .+/gm) || [])
    .map(b => b.replace(/\r?\n|\r/g, ''))
    .map(b => {
      const isTitle = b[0] === '#';
      let res: any = { isTitle };
      if (!isTitle) {
        const div = document.createElement('div');
        div.innerHTML = b;
        const el: any = div.firstChild;
        const { comment, id, tagging, date } = el.dataset;
        const text = el.textContent;
        res.text = `> [!quote] [${text}${tagging ? '（' + tagging + '）' : ''}](${file.path}#^${id}) ${comment ? '\n💬 ' + comment + (self.settings.syncDate ? ' *' + date + '*' : '') : ''}${self.settings.blockId ? ' ^' + md5(text) : ''}`;
        highlights++;
        if (comment) thinks++;
      } else {
        res.text = b;
      }
      return res;
    })
    .filter((o, i, arr) => (o.isTitle ? !arr[i + 1]?.isTitle : true));
  if (t && t.length) {
    t[t.length - 1].isTitle && t.pop();
    if (t.length) {
      content += '\n\n# 划线 \n\n';
      t.forEach(({ text }) => (content += text + '\n\n'));
    }
  }

  // 读书笔记
  const readingNotePath = self.settings.readingNotesToFolder + '/' + file.name;
  const readingNoteFile = self.app.vault.getAbstractFileByPath(readingNotePath);

  if (readingNoteFile) {
    const sourceContent = await self.app.vault.read(readingNoteFile as TFile);
    if (sourceContent !== content) {
      self.app.vault.modify(readingNoteFile as TFile, content);
      self.updateMetadata(file, outlinks, highlights, thinks, dialogue);
      new Notice(file.name + ' - 已同步');
    }
  } else {
    self.app.vault.create(readingNotePath, content);
    self.updateMetadata(file, outlinks, highlights, thinks, dialogue);
    new Notice(file.name + ' - 已同步');
  }
}
