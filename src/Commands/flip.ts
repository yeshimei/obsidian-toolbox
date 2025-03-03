import { Platform, TFile } from 'obsidian';
import { $, COMMENT_CLASS, editorBlur, FOOTNOTE_CLASS, getBasename, MOBILE_HEADER_CLASS, MOBILE_NAVBAR_CLASS, OUT_LINK_CLASS, SOURCE_VIEW_CLASS } from 'src/helpers';
import Toolbox from 'src/main';
import { PanelExhibition } from 'src/Modals/PanelExhibition';
import { PanelExhibitionHlight } from 'src/Modals/PanelExhibitionHlight';

let self: Toolbox;
let pageTurner: PageTurner;

export function flipEvent(f: Toolbox, file: TFile) {
  self = f;
  inspectFullScreen();
  pageTurner && pageTurner.destroy();
  if (!self.settings.flip || !self.hasReadingPage(file)) return;
  const el = document.querySelector(SOURCE_VIEW_CLASS) as HTMLElement;
  pageTurner = new PageTurner(el, {
    onTurnUp: event => flip(event, el, file),
    onTurnDown: event => flip(event, el, file, false),
    onLongPressA: pageTurnerLongPress,
    onLongPressB: fullScreen
  });
}

function flip(event: MouseEvent | TouchEvent, el: HTMLElement, file: TFile, direction = true) {
  const target = event.target as HTMLElement;
  const should = (!pageTurner.isTouchMoving && Platform.isMobile) || Platform.isDesktop
  // 点击划线，显示其评论
  if (target.hasClass(COMMENT_CLASS.slice(1))) should && handleCommentClick(target, file);
  // 点击双链，显示其内容
  else if (target.hasClass(OUT_LINK_CLASS.slice(1))) should && handleOutLinkClick(target, file);
  // 点击脚注，显示其内容
  else if (target.hasClass(FOOTNOTE_CLASS.slice(1))) should && handleFootnoteClick(target, file);
  // 点击其他内容，翻页
  else {
    el.scrollTop = direction ? el.scrollTop - el.clientHeight - self.settings.fileCorrect : el.scrollTop + el.clientHeight + self.settings.fileCorrect;
    self.debounceReadDataTracking(self, file)
  }
}

function fullScreen() {
  if (!Platform.isMobile) return;
  if (pageTurner.keyboardWatcher.isKeyboardVisible) return;
  const t = $(MOBILE_HEADER_CLASS);
  const b = $(MOBILE_NAVBAR_CLASS);

  if (self.settings.fullScreenMode) {
    t?.show();
    b?.show();
    self.settings.fullScreenMode = false;
  } else {
    b?.hide();
    t?.hide();
    self.settings.fullScreenMode = true;
  }

  pageTurner.destroyed = false;
  self.saveSettings();
}

function inspectFullScreen() {
  if (Platform.isMobile && self.settings.fullScreenMode) {
    const t = $(MOBILE_HEADER_CLASS);
    const b = $(MOBILE_NAVBAR_CLASS);
    t?.hide();
    b?.hide();
  }
}



function pageTurnerLongPress () {
  const editor = self.getEditor();
  const selection = editor.getSelection();
  if (Platform.isDesktop) {
    if (selection.length === 0) {
      pageTurner.destroyed = !pageTurner.destroyed;
      if (pageTurner.destroyed) editorBlur(self.app);
    }
  }

  if (Platform.isMobile) {
    if (pageTurner.lock) pageTurner.destroyed = pageTurner.keyboardWatcher.isKeyboardVisible;
    else pageTurner.destroyed = true
  }
} 

function handleCommentClick(target: HTMLElement, file: any) {
  const { comment, date, tagging, id } = target.dataset;
  const formattedTagging = tagging ? `（${tagging}）` : '';
  const formattedDate = date ? `*${date}*` : '';
  const content = comment ? `${comment}${formattedTagging}\n${formattedDate}` : '空空如也';

  new PanelExhibitionHlight(self.app, '评论', content, async () => await deleteTheUnderlinedLine(self, target, file, id, comment)).open();
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

async function handleOutLinkClick(target: HTMLElement, file: TFile) {
  const text = target.textContent.split('|').shift();
  let links = self.app.metadataCache.getFileCache(file)?.links;
  const link = links.find((link: any) => link.displayText === text)?.link;

  if (link) {
    let targetFile = self.getFileByShort(link);
    new PanelExhibition(self.app, getBasename(link), targetFile ? await self.app.vault.read(targetFile) : '空空如也', targetFile && (() => self.app.workspace.getLeaf(true).openFile(targetFile))).open();
  }
}

async function handleFootnoteClick(target: HTMLElement, file: TFile) {
  const footnote = target.textContent;
  const context = await self.app.vault.cachedRead(file);
  const text = new RegExp(`\\[\\^${footnote}\\]: (.*)`).exec(context);
  new PanelExhibition(self.app, '脚注', text ? text[1] : '空空如也').open();
}

type PageTurnerOptions = {
  onTurnUp: (event: MouseEvent | TouchEvent) => void;
  onTurnDown: (event: MouseEvent | TouchEvent) => void;
  onLongPressB: (event: MouseEvent | TouchEvent) => void;
  onLongPressA: (event: MouseEvent | TouchEvent) => void;
};

export class PageTurner {
  element: HTMLElement;
  destroyed: boolean;
  keyboardWatcher: KeyboardObserver;
  isTouchMoving = false;
  lock: boolean
  private options: PageTurnerOptions;
  private touchStartX = 0;
  private touchStartY = 0;
  private isLongPress = false;
  private readonly eventOptions = { capture: true, passive: false };
  private timerA: number 
  private timerB: number

  constructor(element: HTMLElement, options: PageTurnerOptions) {
    this.element = element;
    this.options = options;
    this.destroyed = false;
    this.initializeEvents();
  }

  initializeEvents() {
    this.destroyed = false;
    // 移动端软键盘事件
    this.keyboardWatcher = new KeyboardObserver(
      () => {
        this.destroyed = true
        this.lock = true;
      },
      () => {
        this.destroyed = false;
        this.lock = false;  
        editorBlur(self.app);
      }
    );

    
    // Touch events
    this.element.addEventListener('touchstart', this.handleTouchStart, this.eventOptions);
    this.element.addEventListener('touchmove', this.handleTouchMove, this.eventOptions);
    this.element.addEventListener('touchend', this.handleTouchEnd, this.eventOptions);

    // Wheel events
    this.element.addEventListener('wheel', this.handleWheel, this.eventOptions);
    this.element.addEventListener('click', this.handleClick, this.eventOptions);

    // Mouse events
    this.element.addEventListener('mousedown', this.handleMouseDown, this.eventOptions);
    this.element.addEventListener('mouseup', this.handleMouseUp, this.eventOptions);
    this.element.addEventListener('mouseleave', this.handleMouseLeave, this.eventOptions);
  }

  private handleEvent = (event: Event) => {
    if (this.destroyed) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  private handleTouchStart = (event: TouchEvent) => {
    this.handleEvent(event);
    this.setupLongPressTimers(event)
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.isTouchMoving = false;
  };

  private handleTouchMove = (event: TouchEvent) => {
    if (!this.isTouchMoving) {
      const touch = event.touches[0];
      const deltaX = Math.abs(touch.clientX - this.touchStartX);
      const deltaY = Math.abs(touch.clientY - this.touchStartY);
      if (deltaX > 10 || deltaY > 10) {
        this.isTouchMoving = true;
      }
    }
  };

  private handleTouchEnd = (event: TouchEvent) => {
    this.handleEvent(event);
    this.clearLongPressTimers();
    const touch = event.changedTouches[0];
    if (this.isTouchMoving) {
      const deltaX = touch.clientX - this.touchStartX;
      if (this.destroyed) return;
      if (Math.abs(deltaX) > 30) {
        deltaX > 0 ? this.options.onTurnUp(event) : this.options.onTurnDown(event);
      }
      this.isTouchMoving = false;
    } else if (!this.isLongPress) {
      this.handlePageTurn(event);
    }
  };

  private handleWheel = (event: WheelEvent) => {
    this.handleEvent(event);
    if (this.destroyed) return;
    event.deltaY < 0 ? this.options.onTurnUp(event) : this.options.onTurnDown(event);
  };

  private handleClick = (event: MouseEvent) => {
    this.handleEvent(event);
  };

  private handleMouseDown = (event: MouseEvent) => {
    this.handleEvent(event);
    this.setupLongPressTimers(event);
  };

  private handleMouseUp = (event: MouseEvent) => {
    this.handleEvent(event);
    this.clearLongPressTimers();
    if (!this.isLongPress) {
      this.handlePageTurn(event);
    }
  };

  private handleMouseLeave = (event: MouseEvent) => {
    this.handleEvent(event);
    this.clearLongPressTimers();
  };

  private setupLongPressTimers (event: MouseEvent | TouchEvent) {
    this.clearLongPressTimers();
    this.isLongPress = false;
    this.timerA = window.setTimeout(() => {
      this.options.onLongPressA?.(event);
      this.isLongPress = true;
    }, 500);

    this.timerB = window.setTimeout(() => {
      this.options.onLongPressB?.(event);
      this.isLongPress = true;
    }, 2500);
  }

  private clearLongPressTimers () {
    clearTimeout(this.timerA);
    clearTimeout(this.timerB);
  }

  private handlePageTurn(event: MouseEvent | TouchEvent) {
    let clientY: number;
    if ('touches' in event) {
      const touchEvent = event as TouchEvent;
      const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
      if (!touch) return;
      clientY = touch.clientY;
    } else {
      clientY = event.clientY;
    }

    const rect = this.element.getBoundingClientRect();
    const position = clientY - rect.top;
    if (this.destroyed || !rect.height) return;

    const callback = position < rect.height * 0.45 ? this.options.onTurnUp : this.options.onTurnDown;
    callback(event);
  }

  public destroy() {
    const events = [
      ['touchstart', this.handleTouchStart],
      ['touchmove', this.handleTouchMove],
      ['touchend', this.handleTouchEnd],
      ['wheel', this.handleWheel],
      ['click', this.handleClick],
      ['mousedown', this.handleMouseDown],
      ['mouseup', this.handleMouseUp],
      ['mouseleave', this.handleMouseLeave]
    ] as const
    

    events.forEach(([type, handler]) => {
      this.element.removeEventListener(type, handler, this.eventOptions);
    });
    this.keyboardWatcher.destroy();
  }
}

class KeyboardObserver {
  isKeyboardVisible = false;
  private visualViewport: VisualViewport | null;
  private lastViewportHeight = 0;
  private readonly heightThreshold = 100;

  constructor(public onShow: () => void, public onHide: () => void) {
    this.visualViewport = window.visualViewport || null;
    this.initialize();
  }

  private initialize() {
    this.lastViewportHeight = window.innerHeight;

    if (this.visualViewport) {
      this.visualViewport.addEventListener('resize', this.handleViewportResize);
    } else {
      window.addEventListener('resize', this.handleWindowResize);
      document.addEventListener('focusin', this.handleFocus);
      document.addEventListener('focusout', this.handleBlur);
    }
  }

  private handleViewportResize = () => {
    if (!this.visualViewport) return;

    const newHeight = this.visualViewport.height;
    const heightDiff = this.lastViewportHeight - newHeight;

    if (heightDiff > this.heightThreshold && !this.isKeyboardVisible) {
      this.isKeyboardVisible = true;
      this.onShow();
    } else if (heightDiff <= this.heightThreshold && this.isKeyboardVisible) {
      this.isKeyboardVisible = false;
      this.onHide();
    }

    this.lastViewportHeight = newHeight;
  };

  private handleWindowResize = () => {
    const newHeight = window.innerHeight;
    const heightDiff = this.lastViewportHeight - newHeight;

    if (heightDiff > this.heightThreshold && !this.isKeyboardVisible) {
      this.isKeyboardVisible = true;
      this.onShow();
    } else if (heightDiff <= this.heightThreshold && this.isKeyboardVisible) {
      this.isKeyboardVisible = false;
      this.onHide();
    }

    this.lastViewportHeight = newHeight;
  };

  private handleFocus = () => {
    if (!this.isKeyboardVisible) {
      this.isKeyboardVisible = true;
      this.onShow();
    }
  };

  private handleBlur = () => {
    if (this.isKeyboardVisible) {
      this.isKeyboardVisible = false;
      this.onHide();
    }
  };

  public destroy() {
    if (this.visualViewport) {
      this.visualViewport.removeEventListener('resize', this.handleViewportResize);
    } else {
      window.removeEventListener('resize', this.handleWindowResize);
      document.removeEventListener('focusin', this.handleFocus);
      document.removeEventListener('focusout', this.handleBlur);
    }
  }
}
