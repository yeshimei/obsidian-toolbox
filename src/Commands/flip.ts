import { MarkdownView, Notice, Platform, TFile } from 'obsidian';
import { $, COMMENT_CLASS, createElement, editorBlur, getBasename, MASK_CLASS, MOBILE_HEADER_CLASS, MOBILE_NAVBAR_CLASS, OUT_LINK_CLASS, SOURCE_VIEW_CLASS } from 'src/helpers';
import Toolbox from 'src/main';
import { PanelExhibition } from 'src/Modals/PanelExhibition';
import { PanelExhibitionHlight } from 'src/Modals/PanelExhibitionHlight';

export default function flipCommand(self: Toolbox) {
  self.settings.flip &&
    self.addCommand({
      id: '翻页',
      name: '翻页',
      icon: 'chevron-down',
      editorCallback: (editor, view) => flip(self, view.file)
    });
}

export function flip(self: Toolbox, file: TFile, over = false) {
  if (!self.settings.flip || !self.hasReadingPage(file)) return;
  const el = $(SOURCE_VIEW_CLASS);
  el.scrollTop = over ? el.scrollTop - el.clientHeight - self.settings.fileCorrect : el.scrollTop + el.clientHeight + self.settings.fileCorrect;
  self.debounceReadDataTracking(self, el, file);
}

export function readingPageMask(self: Toolbox, el: HTMLElement, file: TFile) {
  if (!self.settings.flip) return;
  let timer: number, timer2: number, timer3: number, xStart: number, xEnd: number;
  const t = $(MOBILE_HEADER_CLASS);
  const b = $(MOBILE_NAVBAR_CLASS);
  let th: number, bh: number;
  let mask: HTMLElement;
  let viewr = document.querySelector('.view-content') as HTMLElement;

  if (Platform.isMobile) {
    mask = $(MASK_CLASS) || document.body.appendChild(createElement('div', '', MASK_CLASS.slice(1)));
    th = t.offsetHeight || 0;
    bh = b.offsetHeight || 0;
    mask.style.position = 'fixed';
    mask.style.bottom = bh + 10 /* 使其对齐 */ + 'px';
    mask.style.left = '0';
    mask.style.width = '100%';
    mask.style.height = el.clientHeight - th - bh + 'px';
    mask.style.backgroundColor = 'transparent';
    mask.style.zIndex = '1'; // 最小值，使侧边栏等保持正确层级
  } else if (Platform.isDesktop) {
    mask = $(MASK_CLASS) || viewr.appendChild(createElement('div', '', MASK_CLASS.slice(1)));
    mask.style.position = 'absolute';
    mask.style.top = '0';
    mask.style.left = '0';
    mask.style.width = '100%';
    mask.style.height = '100%';
    mask.style.backgroundColor = 'transparent';
  }

  if (self.hasReadingPage(file)) {
    mask.show();
    if (self.settings.fullScreenMode) {
      h();
    }
    // 长按 2.5s 打开或关闭全屏模式
    mask.ontouchstart = e => {
      timer = window.setTimeout(() => mask.hide(), 500);
      timer2 = window.setTimeout(() => {
        if (self.settings.fullScreenMode) {
          s();
          new Notice('已关闭全屏模式');
        } else {
          h();
          new Notice('已开启全屏模式');
        }
        self.settings.fullScreenMode = !self.settings.fullScreenMode;
        self.saveSettings();
        mask.show();
      }, 2500);
      xStart = e.touches[0].pageX;
    };
    mask.ontouchend = e => {
      window.clearTimeout(timer);
      window.clearTimeout(timer2);
      xEnd = e.changedTouches[0].pageX;
      if (xEnd - xStart > 10) {
        flip(self, file, true);
      } else if (xEnd - xStart < -10) {
        flip(self, file);
      }
    };
    if (Platform.isDesktop) {
      let lok = false;
      let lol = false;
      mask.onmousedown = e => {
        timer = window.setTimeout(() => {
          mask.hide();
          lol = false;
          window.clearTimeout(timer2);
          timer2 = window.setTimeout(() => {
            lol = true;
          }, 500);
        }, 500);
      };

      mask.onmouseup = e => {
        window.clearTimeout(timer);
      };

      viewr.onmousedown = e => {
        lok = false;
        timer3 = window.setTimeout(() => (lok = true), 500);
      };

      viewr.onmouseup = e => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const editor = activeView.editor;
        const selection = editor.getSelection();

        if (lok && selection.length == 0 && lol) {
          mask.show();
        }
        window.clearInterval(timer3);
      };
    }

    mask.onclick = async e => {
      const x = e.clientX;
      const y = e.clientY;
      const clickY = e.clientY;
      const windowHeight = window.innerHeight;
      mask.hide();
      const target = document.elementFromPoint(x, y) as HTMLElement;
      mask.show();
      // 点击划线，显示其评论
      if (target.hasClass(COMMENT_CLASS.slice(1))) {
        let { comment, date, tagging, id } = target.dataset;
        tagging && (tagging = `（${tagging}）`);
        date && (date = `*${date}*`);
        new PanelExhibitionHlight(self.app, '评论', comment ? `${comment}${tagging}\n${date}` : '空空如也', async () => await deleteTheUnderlinedLine(self, target, file, id, comment)).open();
      }
      // 点击双链，显示其内容
      else if (target.hasClass(OUT_LINK_CLASS.slice(1))) {
        target.click();
        const text = target.textContent.split('|').shift();
        let links = self.app.metadataCache.getFileCache(file)?.links;
        const link = links.find((link: any) => link.displayText === text)?.link;
        if (link) {
          let file = self.getFileByShort(link);
          new PanelExhibition(self.app, getBasename(link), file ? await self.app.vault.read(file) : '空空如也', file && (() => self.app.workspace.getLeaf(true).openFile(file))).open();
        }
        // 点击脚注，显示其内容
      } else if (target.className === 'cm-footref cm-hmd-barelink') {
        const footnote = target.textContent;
        const context = await self.app.vault.cachedRead(file);
        const text = new RegExp(`\\[\\^${footnote}\\]: (.*)`).exec(context);
        new PanelExhibition(self.app, '脚注', text ? text[1] : '空空如也').open();
      } else {
        if (clickY < windowHeight / 2) {
          flip(self, file, true);
        } else {
          flip(self, file);
        }
      }
    };
    // 移动端软键盘收起时，隐藏遮罩层，反之亦然
    const originalHeight = window.innerHeight;
    window.onresize = () => {
      if (window.innerHeight === originalHeight) {
        mask.show();
        editorBlur(self.app);
      } else {
        mask.hide();
      }
    };
  } else {
    mask.hide();
    mask.onclick = mask.ontouchstart = mask.ontouchend = mask.onmousedown = mask.onmouseup = viewr.onmousedown = viewr.onmouseup = window.onresize = null;
    s();
  }

  function h() {
    if (Platform.isMobile) {
      t.hide();
      b.hide();
      th = t.offsetHeight || 0;
      bh = b.offsetHeight || 0;
      mask.style.bottom = bh + 10 /* 使其对齐 */ + 'px';
      mask.style.height = el.clientHeight - th - bh + 'px';
    }
  }

  function s() {
    if (Platform.isMobile) {
      t.show();
      b.show();
      th = t.offsetHeight || 0;
      bh = b.offsetHeight || 0;
      mask.style.bottom = bh + 10 /* 使其对齐 */ + 'px';
      mask.style.height = el.clientHeight - th - bh + 'px';
    }
  }
}

async function deleteTheUnderlinedLine(self: Toolbox, target: HTMLElement, file: TFile, id: string, comment: string) {
  const text = target.textContent;
  let content = await self.app.vault.read(file);
  let exp = new RegExp(`<span class="__comment cm-highlight" style="white-space: pre-wrap;" data-comment="${comment}" data-id="${id}".*?>${text}</span>`);
  content = content.replace(exp, text);
  // 如果当前段落没其他划线，则删掉段落尾部的 id
  // content = content.replace(new RegExp(`\\^${id}`), '')
  await self.app.vault.modify(file, content);
}
