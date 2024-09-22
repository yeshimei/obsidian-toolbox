import { Editor, htmlToMarkdown, Notice } from 'obsidian';
import { createElement, requestUrlToHTML } from 'src/helpers';
import Toolbox from 'src/main';
import { PanelSearchForWord } from 'src/Modals/PanelSearchForWord';
import { chat } from './chat';

export default function searchForWordCommand(self: Toolbox) {
  self.settings.searchForWords &&
    self.addCommand({
      id: '查词',
      name: '查词',
      icon: 'search',
      editorCallback: editor => searchForWord(self, editor)
    });
}

async function searchForWord(self: Toolbox, editor: Editor) {
  if (!self.settings.searchForWords) return;
  let word = editor.getSelection();
  const notice = new Notice('正在查询汉典和百度百科，请稍等');
  const hanDianUrl = 'https://www.zdic.net/hans/' + word;
  const html = await requestUrlToHTML(hanDianUrl);
  const jnr = html.querySelector('.jnr');
  const pinyin =
    html.querySelector('.ciif .dicpy')?.textContent ||
    Array.from(html.querySelectorAll('.z_py .z_d.song'))
      .map(el => el.textContent)
      .join('|') ||
    '';
  const baiduUrl = 'https://baike.baidu.com/item/' + word;
  const html2 = await requestUrlToHTML(baiduUrl);
  const JSummary = html2.querySelector('.J-summary');
  const div = document.createElement('div');
  const h1 = createElement('h1', '汉典');
  h1.innerHTML = `<a href="${hanDianUrl}" target="_blank">汉典</a>`;
  div.appendChild(h1);
  div.appendChild(jnr || createElement('p', '空空如也'));
  const h11 = createElement('h1', '汉典');
  h11.innerHTML = `<a href="${baiduUrl}" target="_blank">百度百科</a>`;
  div.appendChild(h11);
  div.appendChild(JSummary || createElement('p', '空空如也'));
  notice.hide();
  new PanelSearchForWord(self.app, `${word} ${pinyin}`, div || '空空如也', async type => {
    let file, content, filepath;
    if (type === 'words') {
      const meanings =
        removeDuplicates(Array.from(jnr.querySelectorAll('.cino, .encs')).map(el => el.parentNode.textContent))
          .map(text => filterChineseAndPunctuation(text))
          .map(text => trimNonChineseChars(text))
          .map(text => text.replace(';', '；'))
          .join('；') || htmlToMarkdown(jnr.textContent);
      content = `${word}\`/${pinyin}/\`：${meanings}。`;
      filepath = '词语/' + word + '.md';
    } else if (type === 'cards') {
      const html = JSummary?.textContent;
      let content = html ? htmlToMarkdown(html) : '';
      content = content.replace(/\[\d+\]/g, '');
      filepath = '卡片盒/' + word + '.md';
    } else if (type === 'ai' && self.settings.chat) {
      chat(self, word);
    }

    file = self.app.vault.getFileByPath(filepath);

    if (type === 'cards') {
      file = self.app.vault.getFileByPath('卡片盒/归档/' + word + '.md');
    }

    if (file) {
      new Notice(type === 'words' ? '词语已存在' : '卡片笔记已存在');
    } else {
      file = await self.app.vault.create(filepath, content);
    }
    editor.replaceSelection(`[[${word}]]`);
    self.app.workspace.getLeaf(false).openFile(file);
  }).open();
}

function filterChineseAndPunctuation(str: string) {
  const regex = /[\u4e00-\u9fa5。，、；;]/g;
  return str.match(regex).join('');
}

function trimNonChineseChars(str: string) {
  return str.replace(/^[^\u4e00-\u9fa5]+|[^\u4e00-\u9fa5]+$/g, '');
}

export function removeDuplicates<T>(arr: T[]) {
  return arr.filter((item: T, index: number) => arr.indexOf(item) === index);
}