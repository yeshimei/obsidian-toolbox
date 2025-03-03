import { TFile } from 'obsidian';
import { SOURCE_VIEW_CLASS } from 'src/helpers';
import Toolbox from 'src/main';

// 调整阅读页面样式的函数
// 此函数根据设定的样式和文件类型调整给定元素的字体大小
export default function adjustReadingPageStyle(self: Toolbox, file: TFile) {
  const el = document.querySelector(SOURCE_VIEW_CLASS) as HTMLElement;
  if (!el) return;
  if (self.settings.readingPageStyles && self.hasReadingPage(file)) {
    el.style.fontSize = self.settings.fontSize + 'px';
  } else {
    el.style.fontSize = 'unset';
  }
}
