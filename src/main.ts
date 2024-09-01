import { PanelSearchForWord } from './PanelSearchForWord';
import { Confirm } from './Confirm';
import { PanelHighlight } from './InputBox';
import { Plugin, Editor, Notice, TFile, MarkdownView, htmlToMarkdown, request, Platform, arrayBufferToBase64 } from 'obsidian';
import { ToolboxSettings, DEFAULT_SETTINGS, ToolboxSettingTab } from './settings';
import { createElement, filterChineseAndPunctuation, getBlock, msTo, pick, removeDuplicates, requestUrlToHTML, today, trimNonChineseChars, uniqueBy, debounce, $, extractChineseParts, plantClassificationSystem, blur, codeBlockParamParse, isImageUrl, isEncrypt } from './helpers';
import { md5 } from 'js-md5';
import { PanelExhibition } from './PanelExhibition';
import { PanelSearchForPlants } from './PanelSearchForPlants';
import { convertBase64ToImage, decrypt, encrypt } from './Aes';

const SOURCE_VIEW_CLASS = '.cm-scroller';
const MASK_CLASS = '.__mask';
const MOBILE_HEADER_CLASS = '.view-header';
const MOBILE_NAVBAR_CLASS = '.mobile-navbar-actions';
const COMMENT_CLASS = '.__comment';
const OUT_LINK_CLASS = '.cm-underline';

export default class Toolbox extends Plugin {
  previousFile: TFile;
  encryptionPassCache: any;
  pluginData: any;
  debounceReadDataTracking: Function;
  settings: ToolboxSettings;
  startTime: number;
  async onload() {
    this.encryptionPassCache = [];
    // 加载插件设置页面
    await this.loadSettings();
    this.addSettingTab(new ToolboxSettingTab(this.app, this));
    // 阅读相关仅允许在移动端使用
    if (!Platform.isMobile) {
      Object.assign(this.settings, {
        flip: false,
        fullScreenMode: false,
        readDataTracking: false,
        highlight: false,
        readingNotes: false,
        readingPageStyles: false
      });
      this.saveSettings();
    }

    this.debounceReadDataTracking = debounce(this.readDataTracking.bind(this), this.settings.readDataTrackingDelayTime);
    this.registerEvent(
      this.app.workspace.on('file-open', async file => {
        // document.body.onclick = evt => new Notice((evt.target as HTMLLIElement).className);
        this.startTime = Date.now();
        const sourceView = $(SOURCE_VIEW_CLASS);
        this.polysemy(file); // 多义笔记转跳
        this.adjustPageStyle(sourceView, file); // 阅读页面
        this.mask(sourceView, file); // 点击遮罩层翻页
        this.gallery(); // 画廊
        this.reviewOfReadingNotes(); // 读书笔记回顾
        // // 加密笔记的快捷模式
        // if (this.settings.encryptionQuick) {
        //   // 自动解密当前打开的加密笔记
        //   const encryptionData = (await this.readPluginData()).encryption;
        //   const { encrypted, id } = encryptionData[file.path] || {};
        //   const { pass } = this.encryptionPassCache[id] || {};
        //   if (encrypted && pass) {
        //     await this.dec(file, pass);
        //   }

        //   // 加密笔记自动弹出输入解密密码的窗口
        //   if (id && encrypted && !pass) {
        //     this.decryptPopUp(file);
        //   }

        //   // 上一个打开的解密笔记自动加密
        //   if (this.previousFile) {
        //     const { encrypted, id } = encryptionData[this.previousFile.path] || {};
        //     const { pass } = this.encryptionPassCache[id] || {};
        //     if (!encrypted && pass) {
        //       await this.enc(this.previousFile, pass);
        //     }
        //   }
        // }

        // this.previousFile = file;
      })
    );

    // 预览与编辑模式切换的处理
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        const sourceView = $(SOURCE_VIEW_CLASS);
        const file = this.getView().file;
        this.adjustPageStyle(sourceView, file);
        this.mask(sourceView, file);
      })
    );

    this.addCommand({
      id: '加密笔记',
      name: '加密笔记',
      editorCallback: (editor, view) => this.encryptPopUp(view.file)
    });

    this.addCommand({
      id: '解密笔记',
      name: '解密笔记',
      editorCallback: (editor, view) => this.decryptPopUp(view.file)
    });

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
        editorCallback: (editor, view) => this.footnoteRenumbering(view.file)
      });
    this.settings.blockReference &&
      this.addCommand({
        id: '块引用',
        name: '块引用',
        icon: 'blocks',
        editorCallback: (editor, view) => this.blockReference(editor, view.file)
      });
    this.settings.searchForWords &&
      this.addCommand({
        id: '查词',
        icon: 'search',
        name: '查词',
        editorCallback: editor => this.searchForWords(editor)
      });
    this.settings.searchForPlants &&
      this.addCommand({
        id: '查植物',
        name: '查植物',
        icon: 'flower-2',
        callback: () => this.searchForPlants()
      });
    this.settings.flip &&
      this.addCommand({
        id: '翻页',
        name: '翻页',
        icon: 'chevron-down',
        editorCallback: (editor, view) => this.flip(view.file)
      });
    this.settings.highlight &&
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
            .filter(file => this.hasReadingPage(file))
            .forEach(file => this.syncNote(file))
      });
  }

  gallery() {
    if (!this.settings.gallery) return;
    this.registerMarkdownCodeBlockProcessor('t-gallery', (source, el, ctx) => {
      const { path } = codeBlockParamParse(source);

      if (path) {
        const files = this.app.vault
          .getFiles()
          .filter(file => new RegExp(`^${path}`).test(file.path))
          .filter(file => ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg'].includes(file.extension));
        const content = files.map(file => this.app.vault.adapter.getResourcePath(file.path)).reduce((res, ret) => (res += `<img alt="" src="${ret}">`), '');
        el.innerHTML = content;
      }
    });
  }

  reviewOfReadingNotes() {
    if (!this.settings.reviewOfReadingNotes) return;
    this.registerMarkdownCodeBlockProcessor('t-review', async (source, el, ctx) => {
      const { count } = codeBlockParamParse(source);

      if (count) {
        let highlights: string[] = [];
        const files = this.app.vault.getMarkdownFiles().filter(file => new RegExp(`^${this.settings.readingNotesToFolder}`).test(file.path));
        for (let file of files) {
          const highlight = (await this.app.vault.cachedRead(file)).match(/\[.+?\]\(.*\)/g) as any;
          if (highlight) highlights = highlights.concat(highlight.map((h: any) => ({ text: h, file })));
        }
        const content = pick(highlights, count, false).reduce((res, ret: any) => {
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

  async enc(file: TFile, pass: string, convert = true) {
    if (!this.settings.encryption) return;
    const content = await this.app.vault.read(file);
    if (!pass || !content) return;
    const id = md5(pass);
    const links = await this.imageToBase64(file, pass, convert);
    const decryptContent = convert ? await encrypt(content, pass) : await decrypt(content, pass);
    await this.app.vault.modify(file, decryptContent || content);
    this.settings.plugins.encryption[file.path] = {
      id: id,
      encrypted: !!decryptContent,
      links
    };
    // this.encryptionPassCache[id] = {
    //   pass
    // };
    await this.saveSettings();
  }

  async encryptPopUp(file: TFile) {
    if (!this.settings.encryption) return;
    new PanelHighlight(this.app, '加密笔记', '请输入加密密码。（❗️❗️❗️请注意，本功能还处于测试阶段，请做好备份，避免因意外情况导致数据损坏或丢失。即将加密笔记中所有（wiki 链接形式）的图片并覆盖原图（请做好备份）以及所有文字❗️❗️❗️）', '确定', async pass => {
      new Confirm(this.app, `请确认，加密密码为 ${pass} `, async res => {
        if (!res) return;
        new Confirm(this.app, `请最后一次确认，加密密码为 ${pass} `, async res2 => {
          if (!res2) return;
          this.enc(file, pass);
        }).open();
      }).open();
    }).open();
  }

  async decryptPopUp(file: TFile) {
    if (!this.settings.encryption) return;
    new PanelHighlight(this.app, '解密笔记', '请输入解密密码。', '确定', async pass => this.enc(file, pass, false)).open();
  }

  async imageToBase64(file: TFile, pass: string, convert = true) {
    const args = (await this.app.vault.read(file)).split('%');
    let links = (args.length === 1 ? Object.keys(this.app.metadataCache.resolvedLinks[file.path]).filter(isImageUrl) : this.settings.plugins.encryption[file.path]?.links) || [];
    try {
      for (let link of links) {
        const file = this.app.metadataCache.getFirstLinkpathDest(link, '');
        if (convert) {
          const arrayBuffer = await this.app.vault.adapter.readBinary(file.path);
          const content = await this.app.vault.read(file);
          let base64 = arrayBufferToBase64(arrayBuffer);
          if (isEncrypt(content)) {
            args.length === 1 && new Notice(`${link} 已加密`);
          } else {
            this.app.vault.modify(file, await encrypt(base64, pass));
          }
        } else {
          const base64 = await this.app.vault.read(file);
          if (isEncrypt(base64)) {
            const bytes = convertBase64ToImage(await decrypt(base64, pass));
            await this.app.vault.adapter.writeBinary(file.path, bytes);
          } else {
            new Notice(`${link} 未加密`);
          }
        }
      }
    } catch (e) {
      new Notice(e);
    }

    return links;
  }

  async searchForPlants() {
    if (!this.settings.searchForPlants) return;
    new PanelSearchForPlants(this.app, async (name: string) => {
      const html = await requestUrlToHTML('https://www.iplant.cn/info/' + name);
      const id = html.querySelector('.barcodeimg img').getAttr('src').split('=').pop();
      const latinName = html.querySelector('#sptitlel')?.textContent;
      let alias = html.querySelector('.infomore>div')?.firstChild?.textContent;
      let other = html.querySelector('.infomore>.spantxt')?.textContent;

      if (latinName.trim() === '' && other) {
        new Notice(`${name}？您是否在找 ${other}`);
        return;
      }

      if (id === '') {
        new Notice(`${name}？您可能输入错误或植物智不存在相关植物`);
        return;
      }

      if (alias.indexOf('俗名') > -1) {
        alias = alias.split('、').join('\n - ').replace('俗名：', '\n - ');
      } else {
        alias = ' ';
      }

      const classsys = extractChineseParts(JSON.parse(await request(`https://www.iplant.cn/ashx/getspinfos.ashx?spid=${id}&type=classsys`)).classsys.find((text: string) => Object.keys(plantClassificationSystem).some(name => text.indexOf(name) > -1)));

      const plantIntelligence = await request(`https://www.iplant.cn/ashx/getfrps.ashx?key=${latinName.split(' ').join('+')}`);
      const lifestyleForm = plantIntelligence ? htmlToMarkdown(JSON.parse(plantIntelligence).frpsdesc).replace(/^[^\n]*\n[^\n]*\n[^\n]*\n/, '') : '《植物智》未收录。';

      const content = `---\n中文名: ${name}\n拉丁学名: ${latinName}\n别名: ${alias}\n${classsys}\n识别特征: \n---\n${lifestyleForm}`;

      const filepath = '卡片盒/归档/' + name + '.md';
      let file = this.app.vault.getFileByPath(filepath) || this.app.vault.getFileByPath('卡片盒/' + name + '.md');
      if (file) {
        new Notice('查询的植物笔记已存在');
      } else {
        file = await this.app.vault.create(filepath, content);
      }
      this.app.workspace.getLeaf(true).openFile(file);
    }).open();
  }

  blockReference(editor: Editor, file: TFile) {
    if (!this.settings.blockReference) return;
    let blockId = getBlock(this.app, editor, file);
    window.navigator.clipboard.writeText(`[[${file.path.replace('.' + file.extension, '')}#^${blockId}|${file.basename}]]`);
    new Notice('块引用已复制至剪切板！');
  }

  mask(el: HTMLElement, file: TFile) {
    if (!this.settings.flip) return;
    let timer: number, timer2: number, xStart: number, xEnd: number;
    const t = $(MOBILE_HEADER_CLASS);
    const b = $(MOBILE_NAVBAR_CLASS);
    let mask = $(MASK_CLASS) || document.body.appendChild(createElement('div', '', MASK_CLASS.slice(1)));
    if (this.hasReadingPage(file)) {
      if (this.settings.fullScreenMode) {
        t.hide();
        b.hide();
      }
      const th = t.offsetHeight || 0;
      const bh = b.offsetHeight || 0;
      mask.style.position = 'fixed';
      mask.style.bottom = bh + 10 /* 使其对齐 */ + 'px';
      mask.style.left = '0';
      mask.style.width = '100%';
      mask.style.height = el.clientHeight - th - bh + 'px';
      // mask.style.backgroundColor = 'rgba(255,0,0,0.5)';
      mask.style.backgroundColor = 'transparent';
      mask.style.zIndex = '1'; // 最小值，使侧边栏等保持正确层级
      mask.show();
      // 长按 2.5s 打开或关闭全屏模式
      mask.ontouchstart = e => {
        timer = window.setTimeout(() => mask.hide(), 500);
        timer2 = window.setTimeout(() => {
          if (this.settings.fullScreenMode) {
            t.show();
            b.show();
            new Notice('已关闭全屏模式');
          } else {
            t.hide();
            b.hide();
            new Notice('已开启全屏模式');
          }
          this.settings.fullScreenMode = !this.settings.fullScreenMode;
          this.saveSettings();
        }, 2500);
        xStart = e.touches[0].pageX;
      };
      mask.ontouchend = e => {
        window.clearTimeout(timer);
        window.clearTimeout(timer2);
        xEnd = e.changedTouches[0].pageX;
        if (xEnd - xStart > 10) {
          this.flip(file, true);
        } else if (xEnd - xStart < -10) {
          this.flip(file);
        }
      };
      mask.onclick = async e => {
        const x = e.clientX;
        const y = e.clientY;
        mask.hide();
        const target = document.elementFromPoint(x, y) as HTMLElement;
        mask.show();
        // 点击划线，显示其评论
        if (target.hasClass(COMMENT_CLASS.slice(1))) {
          const text = target.textContent;
          const { comment, date } = target.dataset;
          new PanelExhibition(this.app, '评论', comment ? createElement('p', `${comment}${date ? '</br></br><i>' + date + '</i>' : ''}`) : '空空如也').open();
        }
        // 点击双链，显示其内容
        else if (target.hasClass(OUT_LINK_CLASS.slice(1))) {
          target.click();
          const text = target.textContent.split('|').shift();
          const file = this.getFileByShort(text);
          new PanelExhibition(this.app, text, file ? createElement('p', await this.app.vault.read(file)) : '空空如也', file && (() => this.app.workspace.getLeaf(false).openFile(file))).open();
        } else {
          this.flip(file);
        }
      };
      // 移动端软键盘收起时，隐藏遮罩层，反之亦然
      const originalHeight = window.innerHeight;
      window.onresize = () => {
        if (window.innerHeight === originalHeight) {
          mask.show();
          blur(this.app);
        } else {
          mask.hide();
        }
      };
    } else {
      mask.hide();
      mask.onclick = mask.ontouchstart = mask.ontouchend = window.onresize = null;
      t.show();
      b.show();
    }
  }

  adjustPageStyle(el: HTMLElement, file: TFile) {
    if (this.settings.readingPageStyles && this.hasReadingPage(file)) {
      el.style.fontSize = this.settings.fontSize + 'px';
    } else {
      el.style.fontSize = 'unset';
    }
  }

  async syncNote(file: TFile) {
    if (!this.settings.readingNotes) return;
    let markdown = await this.app.vault.read(file);
    let highlights = 0;
    let thinks = 0;
    let outlinks = 0;

    const { links, frontmatter } = this.app.metadataCache.getFileCache(file);
    let content = '---\ntags: 读书笔记\n---';
    // 出链
    if (this.settings.outLink && links) {
      content += '\n\n# 出链\n\n';
      uniqueBy(links, (link: any) => link.link).forEach(({ link }) => (content += `[[${link}|${link.split('/').pop()}]] / `));
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
    if (!this.settings.highlight) return;
    let text = editor.getSelection();
    new PanelHighlight(this.app, text, '划线', '写想法', async res => {
      let blockId = getBlock(this.app, editor, file);
      res = `<span class="__comment cm-highlight" data-comment="${res || ''}" data-id="${blockId}" data-date="${today(true)}">${text}</span>`;
      editor.replaceSelection(res);
    }).open();
  }

  readDataTracking(el: Element, file: TFile) {
    if (!this.settings.readDataTracking || !this.hasReadingPage(file)) return;
    let { readingProgress = 0, readingDate, completionDate } = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    this.app.fileManager.processFrontMatter(file, frontmatter => {
      if (readingDate && !completionDate) {
        // 阅读进度
        frontmatter.readingProgress = parseFloat((((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100).toFixed(2));
        // 阅读时长
        if (!frontmatter.readingTime) frontmatter.readingTime = 0;
        frontmatter.readingTime += Math.min(this.settings.readDataTrackingTimeout, Date.now() - this.startTime);
        this.startTime = Date.now();
        // 格式化的阅读时长
        frontmatter.readingTimeFormat = msTo(frontmatter.readingTime);
      }
      // 是否未读
      if (!readingDate) {
        new Confirm(this.app, `《${file.basename}》未过读，是否标记在读？`, res => {
          res && this.updateFrontmatter(file, 'readingDate', today());
        }).open();
      }
      // 是否读完
      if (readingProgress >= 100 && !completionDate) {
        new Confirm(this.app, `《${file.basename}》进度 100%，是否标记读完？`, res => res && this.updateFrontmatter(file, 'completionDate', today())).open();
      }
    });
  }

  async searchForWords(editor: Editor) {
    if (!this.settings.searchForWords) return;
    let word = editor.getSelection();
    const html = await requestUrlToHTML('https://www.zdic.net/hans/' + word);
    const jnr = html.querySelector('.jnr');
    const pinyin =
      html.querySelector('.ciif .dicpy')?.textContent ||
      Array.from(html.querySelectorAll('.z_py .z_d.song'))
        .map(el => el.textContent)
        .join('|') ||
      '';
    const html2 = await requestUrlToHTML('https://baike.baidu.com/item/' + word);
    const JSummary = html2.querySelector('.J-summary');
    const div = document.createElement('div');
    div.appendChild(createElement('h1', '汉典'));
    div.appendChild(jnr || createElement('p', '空空如也'));
    div.appendChild(createElement('h1', '百度百科'));
    div.appendChild(JSummary || createElement('p', '空空如也'));
    new PanelSearchForWord(
      this.app,
      `${word} ${pinyin}`,
      div || '空空如也',
      async () => {
        const meanings =
          removeDuplicates(Array.from(jnr.querySelectorAll('.cino, .encs')).map(el => el.parentNode.textContent))
            .map(text => filterChineseAndPunctuation(text))
            .map(text => trimNonChineseChars(text))
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
    if (!this.settings.passwordCreator) return;
    const pass = pick(this.settings.passwordCreatorMixedContent.split(''), this.settings.passwordCreatorLength).join('');
    window.navigator.clipboard.writeText(pass);
    new Notice('密码已复制至剪切板！');
  }

  async footnoteRenumbering(file: TFile) {
    if (!this.settings.footnoteRenumbering) return;
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
    if (!this.settings.polysemy) return;
    const to = this.getMetadata(file, 'to');
    if (!to) return;
    let filename = to.match(/\[\[(.*)\]\]/)?.[1];
    if (!filename) return;
    let targetFile = this.getFileByShort(filename);
    if (!targetFile) return;
    const LastOpenFiles = this.app.workspace.getLastOpenFiles();
    if (LastOpenFiles[1] === file.path) return;
    const view = this.app.workspace.getLeaf(true);
    view.openFile(targetFile);
    new Notice(`《${file.basename}》是一篇多义笔记，已转跳至《${filename}》 `);
  }

  flip(file: TFile, over = false) {
    if (!this.settings.flip || !this.hasReadingPage(file)) return;
    const el = $(SOURCE_VIEW_CLASS);
    el.scrollTop = over ? el.scrollTop - el.clientHeight - this.settings.fileCorrect : el.scrollTop + el.clientHeight + this.settings.fileCorrect;
    this.debounceReadDataTracking(el, file);
  }

  updateFrontmatter(file: TFile, key: string, value: string | number) {
    this.app.fileManager.processFrontMatter(file, frontmatter => {
      frontmatter[key] = value;
    });
  }

  updateMetadata(file: TFile, outlinks: number, highlights: number, thinks: number) {
    this.updateFrontmatter(file, 'outlinks', outlinks);
    this.updateFrontmatter(file, 'highlights', highlights);
    this.updateFrontmatter(file, 'thinks', thinks);
  }

  getView() {
    return this.app.workspace.getActiveViewOfType(MarkdownView);
  }

  getEditor() {
    return this.getView()?.editor;
  }

  getFileByShort(filename: string) {
    return this.app.vault.getMarkdownFiles().find(({ basename, path, extension }) => basename === filename || path.replace('.' + extension, '') === filename);
  }

  getMetadata(file: TFile, key: string) {
    return file && this.app.metadataCache.getFileCache(file)?.frontmatter?.[key];
  }

  hasReadingPage(file: TFile) {
    return file && file.extension === 'md' && this.hasTag(file, 'book') && this.hasRootFolder(file, this.settings.readDataTrackingFolder) && this.getView().getMode() === 'source';
  }

  hasRootFolder(file: TFile, folderName: string) {
    const args = file.path.split('/');
    return args.length > 1 && args.shift() === folderName;
  }

  hasTag(file: TFile, name: string) {
    let tags = this.app.metadataCache.getFileCache(file)?.frontmatter?.tags || [];
    Array.isArray(tags) || (tags = [tags]);
    return tags.includes(name);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // async savePluginData(data: any) {
  //   await this.app.vault.adapter.write('.obsidian/plugins/toolbox/plugin-data.json', JSON.stringify(data));
  // }

  // async readPluginData() {
  //   let d;
  //   try {
  //     d = await this.app.vault.adapter.read('.obsidian/plugins/toolbox/plugin-data.json');
  //   } catch (e) {}

  //   return d && JSON.parse(d);
  // }
}
