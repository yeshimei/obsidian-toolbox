import { Notice, TFile } from 'obsidian';
import { $, COMMENT_CLASS, createElement, editorBlur, MASK_CLASS, MOBILE_HEADER_CLASS, MOBILE_NAVBAR_CLASS, OUT_LINK_CLASS, SOURCE_VIEW_CLASS } from 'src/helpers';
import Toolbox from 'src/main';
import { PanelExhibition } from 'src/Modals/PanelExhibition';

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
  let timer: number, timer2: number, xStart: number, xEnd: number;
  const t = $(MOBILE_HEADER_CLASS);
  const b = $(MOBILE_NAVBAR_CLASS);
  let th: number, bh: number;
  let mask = $(MASK_CLASS) || document.body.appendChild(createElement('div', '', MASK_CLASS.slice(1)));
  if (self.hasReadingPage(file)) {
    if (self.settings.fullScreenMode) {
      h();
    }
    th = t.offsetHeight || 0;
    bh = b.offsetHeight || 0;
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
    mask.onclick = async e => {
      const x = e.clientX;
      const y = e.clientY;
      mask.hide();
      const target = document.elementFromPoint(x, y) as HTMLElement;
      mask.show();
      // 点击划线，显示其评论
      if (target.hasClass(COMMENT_CLASS.slice(1))) {
        const text = target.textContent;
        const { comment, date, tagging } = target.dataset;
        new PanelExhibition(self.app, '评论', comment ? createElement('p', `${comment}${date ? ('</br></br><i>' + date + tagging ? '（' + tagging + '）' : '' + '</i>') : ''}`) : '空空如也').open();
      }
      // 点击双链，显示其内容
      else if (target.hasClass(OUT_LINK_CLASS.slice(1))) {
        target.click();
        const text = target.textContent.split('|').shift();
        const file = self.getFileByShort(text);
        new PanelExhibition(self.app, text, file ? createElement('p', await self.app.vault.read(file)) : '空空如也', file && (() => self.app.workspace.getLeaf(false).openFile(file))).open();
        // 点击脚注，显示其内容
      } else if (target.className === 'cm-footref cm-hmd-barelink') {
        const footnote = target.textContent;
        const context = await self.app.vault.cachedRead(file);
        const text = new RegExp(`\\[\\^${footnote}\\]: (.*)`).exec(context);
        new PanelExhibition(self.app, '脚注', createElement('p', text ? text[1] : '空空如也')).open();
      } else {
        flip(self, file);
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
    mask.onclick = mask.ontouchstart = mask.ontouchend = window.onresize = null;
    s();
  }

  function h() {
    t.hide();
    b.hide();
    th = t.offsetHeight || 0;
    bh = b.offsetHeight || 0;
    mask.style.bottom = bh + 10 /* 使其对齐 */ + 'px';
    mask.style.height = el.clientHeight - th - bh + 'px';
  }

  function s() {
    t.show();
    b.show();
    th = t.offsetHeight || 0;
    bh = b.offsetHeight || 0;
    mask.style.bottom = bh + 10 /* 使其对齐 */ + 'px';
    mask.style.height = el.clientHeight - th - bh + 'px';
  }
}
