import { Panel } from './Panel';
import { Confirm } from './Confirm';
import { InputBox } from './InputBox';
import { Plugin, Editor, Notice, TFile, requestUrl, MarkdownView, moment, htmlToMarkdown } from 'obsidian';
import { ToolboxSettings, DEFAULT_SETTINGS, ToolboxSettingTab } from './settings';
import { getBlock, uniqueBy } from './helpers';
import { md5 } from 'js-md5';

export default class Toolbox extends Plugin {
  settings: ToolboxSettings;
  startTime: number;
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new ToolboxSettingTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on('file-open', file => {
        this.startTime = Date.now();
        const viewEl = document.querySelector('.cm-scroller') as HTMLElement;
        const mobileNavbar = document.querySelector('.mobile-navbar-actions') as HTMLElement;
        this.polysemy(file); // 多义笔记转跳
        viewEl.ontouchstart = evt => {
          if (evt.touches.length === 2) {
            this.flip(); // 翻页
            this.readDataTracking(viewEl, file); // 跟踪阅读时长
          }
        };
        mobileNavbar && (mobileNavbar.onclick = () => this.flip()); // 点击移动端底部的 navbar 翻页
        viewEl.onscroll = this.debounce(() => this.readDataTracking(viewEl, file));
        viewEl.onclick = evt => this.showComment(evt); // 点击划线时在通知里显示评论
      })
    );

    this.settings.passwordCreator &&
      this.addCommand({
        id: '密码创建器',
        name: '密码创建器',
        callback: () => this.passwordCreator()
      });
    this.settings.footnoteRenumbering &&
      this.addCommand({
        id: '脚注重编号',
        name: '脚注重编号',
        callback: () => this.footnoteRenumbering()
      });
    this.settings.searchForWords &&
      this.addCommand({
        id: '查词',
        icon: 'search',
        name: '查词',
        editorCallback: editor => this.searchForWords(editor)
      });
    this.settings.flip &&
      this.addCommand({
        id: '翻页',
        name: '翻页',
        icon: 'chevron-down',
        callback: () => this.flip()
      });
    this.settings.drawALine &&
      this.addCommand({
        id: '划线',
        name: '划线',
        icon: 'brush',
        editorCallback: (editor, view) => this.highlight(editor, view.file)
      });

    this.settings.readingNotes &&
      this.addCommand({
        id: '同步读书笔记',
        name: '同步读书笔记',
        icon: 'activity',
        callback: () =>
          this.app.vault
            .getMarkdownFiles()
            .filter(file => file.path.indexOf(this.settings.readDataTrackingFolder) > -1)
            .filter(file => this.hasTag(file, 'book'))
            .forEach(file => this.syncNote(file))
      });
  }

  showComment(evt: MouseEvent) {
    const target = evt.target as HTMLElement;
    if (target.hasClass('__comment')) {
      const { comment, date } = target.dataset;
      new Notice(comment ? `${comment}${date ? '\n\n' + date : ''}` : '空空如也');
    }
  }

  async syncNote(file: TFile) {
    let markdown = await this.app.vault.read(file);
    let highlights = 0;
    let thinks = 0;
    let outlinks = 0;

    const { links, frontmatter } = this.app.metadataCache.getFileCache(file);
    let content = '---\ntags: 读书笔记\n---';
    // 出链
    if (this.settings.outLink && links) {
      content += '\n\n# 出链\n\n';
      uniqueBy(links, 'link').forEach(({ link }) => (content += `[[${link}|${link.split('/').pop()}]] / `));
      content = content.slice(0, -3);
      outlinks = links.length;
    }

    // 书评
    let { bookReview } = frontmatter;
    bookReview && (content += `\n\n# 书评 \n\n > [!tip] ${bookReview}${this.settings.blockId ? ' ^' + md5(bookReview) : ''}`);

    // 划线
    const t = (markdown.match(/<span class="__comment.+?<\/span>|#{1,6} .+/gm) || [])
      .map(b => {
        const isTitle = b[0] === '#';
        let res: any = { isTitle };
        if (!isTitle) {
          const div = document.createElement('div');
          div.innerHTML = b;
          const el: any = div.firstChild;
          const { comment, id } = el.dataset;
          const text = el.textContent;
          res.text = `> [!quote] [${text}](${file.path}#^${id}) ${comment ? '\n💬 ' + comment : ''}${this.settings.blockId ? ' ^' + md5(text) : ''}`;
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
    const readingNotePath = this.settings.readingNotesToFolder + '/' + file.name;
    const readingNoteFile = this.app.vault.getAbstractFileByPath(readingNotePath);

    if (readingNoteFile) {
      const sourceContent = await this.app.vault.read(readingNoteFile as TFile);
      if (sourceContent !== content) {
        this.app.vault.modify(readingNoteFile as TFile, content);
        this.updateMetadata(file, outlinks, highlights, thinks);
        new Notice(file.name + ' - 已同步');
      }
    } else {
      this.app.vault.create(readingNotePath, content);
      this.updateMetadata(file, outlinks, highlights, thinks);
      new Notice(file.name + ' - 已同步');
    }
  }

  highlight(editor: Editor, file: TFile) {
    let text = editor.getSelection();
    let blockId = getBlock(this.app, editor, file);
    new InputBox(this.app, text, '写想法', async res => {
      res = `<span class="__comment cm-highlight" data-comment="${res || ''}" data-id="${blockId}" data-date="${this.today(true)}">${text}</span>`;
      editor.replaceSelection(res);
    }).open();
  }

  readDataTracking(el: Element, file: TFile) {
    let { readingProgress = 0, readingDate, completionDate, tags } = this.app.metadataCache.getFileCache(file).frontmatter || {};
    tags = Array.isArray(tags) ? tags : [tags];
    if (!file || file.extension !== 'md' || !tags.includes('book') || !this.settings.readDataTracking) return;
    this.app.fileManager.processFrontMatter(file, frontmatter => {
      if (readingDate && !completionDate) {
        // 阅读进度
        frontmatter.readingProgress = parseFloat((((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100).toFixed(2));
        // 阅读时长
        if (!frontmatter.readingTime) frontmatter.readingTime = 0;
        frontmatter.readingTime += Math.min(this.settings.readDataTrackingTimeout, Date.now() - this.startTime);
        this.startTime = Date.now();
        // 格式化的阅读时长
        frontmatter.readingTimeFormat = this.msTo(frontmatter.readingTime);
      }
      // 是否未读
      if (!readingDate) {
        new Confirm(this.app, `《${file.basename}》未过读，是否标记在读？`, res => {
          res && this.updateFrontmatter(file, 'readingDate', this.today());
        }).open();
      }
      // 是否读完
      if (readingProgress >= 100 && !completionDate) {
        new Confirm(this.app, `《${file.basename}》进度 100%，是否标记读完？`, res => res && this.updateFrontmatter(file, 'completionDate', this.today())).open();
      }
    });
  }

  async searchForWords(editor: Editor) {
    let word = editor.getSelection();
    const html = await this.requestUrlToHTML('https://www.zdic.net/hans/' + word);
    const jnr = html.querySelector('.jnr');
    const pinyin =
      html.querySelector('.ciif .dicpy')?.textContent ||
      Array.from(html.querySelectorAll('.z_py .z_d.song'))
        .map(el => el.textContent)
        .join('|') ||
      '';
    const html2 = await this.requestUrlToHTML('https://baike.baidu.com/item/' + word);
    const JSummary = html2.querySelector('.J-summary');
    const div = document.createElement('div');
    div.appendChild(this.createElement('h1', '汉典'));
    div.appendChild(jnr || this.createElement('p', '空空如也'));
    div.appendChild(this.createElement('h1', '百度百科'));
    div.appendChild(JSummary || this.createElement('p', '空空如也'));
    new Panel(
      this.app,
      editor,
      `${word} ${pinyin}`,
      div || '空空如也',
      async () => {
        const meanings =
          this.removeDuplicates(Array.from(jnr.querySelectorAll('.cino, .encs')).map(el => el.parentNode.textContent))
            .map(text => this.filterChineseAndPunctuation(text))
            .map(text => this.trimNonChineseChars(text))
            .map(text => text.replace(';', '；'))
            .join('；') || htmlToMarkdown(jnr.textContent);
        const content = `${word}\`/${pinyin}/\`：${meanings}。`;
        const filepath = '词语/' + word + '.md';
        let file = this.app.vault.getFileByPath(filepath);
        if (file) {
          new Notice('词语已存在');
        } else {
          file = await this.app.vault.create(filepath, content);
        }
        editor.replaceSelection(`[[${word}]]`);
        this.app.workspace.getLeaf(true).openFile(file);
      },
      async () => {
        let content = htmlToMarkdown(JSummary.textContent);
        if (!content) return;
        content = content.replace(/\[\d+\]/g, '');
        const filepath = '卡片盒/' + word + '.md';
        let file = this.app.vault.getFileByPath(filepath) || this.app.vault.getFileByPath('卡片盒/归档/' + word + '.md');
        if (file) {
          new Notice('卡片笔记已存在');
        } else {
          file = await this.app.vault.create(filepath, content);
        }
        editor.replaceSelection(`[[${word}]]`);
        this.app.workspace.getLeaf(true).openFile(file);
      }
    ).open();
  }

  passwordCreator() {
    const pass = this.pick(this.settings.passwordCreatorMixedContent.split(''), this.settings.passwordCreatorLength).join('');
    window.navigator.clipboard.writeText(pass);
    new Notice('密码已复制至剪切板！');
  }

  async footnoteRenumbering() {
    const file = this.getView()?.file;
    let context = await this.app.vault.read(file);

    let i1 = 1;
    let i2 = 1;

    context = context
      .replace(/\[\^(\d+)\][^:]/g, function (a) {
        return a.replace(/\d+/, String(i1++));
      })
      .replace(/\[\^(\d+)\]:/g, function (a) {
        return a.replace(/\d+/, String(i2++));
      });

    await this.app.vault.modify(file, context);
    new Notice(`已为${i1 - 1}个脚注重新编号`);
  }

  polysemy(file: TFile) {
    const to = this.app.metadataCache.getFileCache(file)?.frontmatter?.to;
    if (to) {
      let filename = to.match(/\[\[(.*)\]\]/)?.[1];
      let files = this.app.vault.getMarkdownFiles();

      let targetFile = files.find(({ basename, path, extension }) => basename === filename || path.replace('.' + extension, '') === filename);

      if (targetFile) {
        const LastOpenFiles = this.app.workspace.getLastOpenFiles();
        if (LastOpenFiles[1] !== file.path) {
          const view = this.app.workspace.getLeaf(true);
          view.openFile(targetFile);
          new Notice(`《${file.basename}》是一篇多义笔记，已转跳至《${filename}》 `);
        }
      }
    }
  }

  async requestUrlToHTML(url: string) {
    const content = await requestUrl(url);
    const div = document.createElement('div');
    div.innerHTML = content.text;
    return div;
  }

  createElement(t: string, text: string) {
    const el = document.createElement(t);
    el.innerText = text;
    return el;
  }

  filterChineseAndPunctuation(str: string) {
    const regex = /[\u4e00-\u9fa5。，、；;]/g;
    return str.match(regex).join('');
  }

  trimNonChineseChars(str: string) {
    return str.replace(/^[^\u4e00-\u9fa5]+|[^\u4e00-\u9fa5]+$/g, '');
  }

  removeDuplicates<T>(arr: T[]) {
    return arr.filter((item: T, index: number) => arr.indexOf(item) === index);
  }

  pick<T>(arr: T[], n: number = 1, repeat = true): T[] {
    if (n >= arr.length) {
      return arr;
    }
    let result: T[] = [];
    let picked: Set<number> = new Set();
    for (let i = 0; i < n; i++) {
      let index = Math.floor(Math.random() * arr.length);
      if (!repeat) {
        while (picked.has(index)) {
          index = Math.floor(Math.random() * arr.length);
        }
        picked.add(index);
      }

      result.push(arr[index]);
    }
    return result;
  }

  flip() {
    if (!this.settings.flip) return;
    const el = document.querySelector('.cm-scroller');
    el.scrollTop += el.clientHeight + this.settings.fileCorrect;
  }

  pageUp(editor: Editor) {
    if (!this.settings.flip) return;
    const { top, clientHeight } = editor.getScrollInfo();
    editor.scrollTo(0, top - clientHeight + this.settings.fileCorrect);
  }

  updateFrontmatter(file: TFile, key: string, value: string | number) {
    this.app.fileManager.processFrontMatter(file, frontmatter => {
      frontmatter[key] = value;
    });
  }

  msTo(t: number) {
    let duration = moment.duration(t, 'milliseconds');
    let hours = duration.hours();
    let minutes = duration.minutes();
    let seconds = duration.seconds();
    return `${hours ? hours + 'h' : ''}${minutes ? minutes + 'm' : ''}${seconds ? seconds + 's' : ''}`;
  }

  updateMetadata(file: TFile, outlinks: number, highlights: number, thinks: number) {
    this.updateFrontmatter(file, 'outlinks', outlinks);
    this.updateFrontmatter(file, 'highlights', highlights);
    this.updateFrontmatter(file, 'thinks', thinks);
  }

  today(more = false) {
    return moment().format('YYYY-MM-DD' + (more ? ' hh:mm:ss' : ''));
  }

  getView() {
    return this.app.workspace.getActiveViewOfType(MarkdownView);
  }

  debounce(fn: Function, delay: number = 500) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return function (...args: any[]) {
      if (timer) {
        clearTimeout(timer); // 清除之前的定时器
      }
      timer = setTimeout(() => {
        fn(...args); // 在延迟后执行传入的函数
      }, delay);
    };
  }

  hasTag(file: TFile, name: string) {
    return this.app.metadataCache.getFileCache(file)?.frontmatter?.tags?.contains(name);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
