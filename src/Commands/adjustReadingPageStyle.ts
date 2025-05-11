import { TFile } from 'obsidian';
import {SOURCE_VIEW_CLASS } from 'src/helpers';
import Toolbox from 'src/main';

// 调整阅读页面样式的函数
// 此函数根据设定的样式和文件类型调整给定元素的字体大小
export default function adjustReadingPageStyle(self: Toolbox, file: TFile) {
  const el = self.getView()?.contentEl?.querySelector(SOURCE_VIEW_CLASS) as HTMLElement;
  if (!el) return;
  if (self.settings.readingPageStyles && self.hasReadingPage(file)) {
    el.style.fontSize = self.settings.fontSize + 'px';
    hideElementScrollbar(el);
  } else {
    el.style.fontSize = 'unset';
    el.classList.remove('hide-scrollbar');
  }
}


/**
 * 隐藏指定元素的滚动条（保留滚动功能）
 * @param {HTMLElement} element 需要隐藏滚动条的 DOM 元素
 */
function hideElementScrollbar(element: HTMLElement) {
  // 创建全局样式（仅需执行一次）
  if (!document.getElementById('hide-scrollbar-style')) {
      const style = document.createElement('style');
      style.id = 'hide-scrollbar-style';
      style.textContent = `
          .hide-scrollbar {
              scrollbar-width: none; /* Firefox */
              -ms-overflow-style: none; /* IE/Edge */
          }
          .hide-scrollbar::-webkit-scrollbar {
              display: none; /* Chrome/Safari/Webkit */
          }
      `;
      document.head.appendChild(style);
  }
  
  // 添加隐藏滚动条类
  element.classList.add('hide-scrollbar');
}