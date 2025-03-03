import { Editor, htmlToMarkdown, Notice } from 'obsidian';
import { createElement, hasRootFolder, requestUrlToHTML } from 'src/helpers';
import Toolbox from 'src/main';
import { PanelSearchForWord } from 'src/Modals/PanelSearchForWord';

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
  let pinyin: string; 
  let div = document.createElement('div');
  let word = editor.getSelection();
  let jnr: HTMLElement;
  let JSummary: HTMLElement;
  const baiduUrl = 'https://baike.baidu.com/item/' + word;
  const h11 = createElement('h1', '汉典');
  h11.innerHTML = `<a href="${baiduUrl}" target="_blank">百度百科</a>`;
  const h1 = createElement('h1', '汉典');
  const hanDianUrl = 'https://www.zdic.net/hans/' + word;
    h1.innerHTML = `<a href="${hanDianUrl}" target="_blank">汉典</a>`;
  const notice = new Notice('正在查询汉典和百度百科，请稍等');
  try {
    const html = await requestUrlToHTML(hanDianUrl);
    jnr = html.querySelector('.jnr');
    pinyin =
      html.querySelector('.ciif .dicpy')?.textContent ||
      Array.from(html.querySelectorAll('.z_py .z_d.song'))
        .map(el => el.textContent)
        .join('|') ||
      '';
    const html2 = await requestUrlToHTML(baiduUrl);
    JSummary = html2.querySelector('.J-summary');
  } catch (error) {}
    div.appendChild(h1);
    div.appendChild(jnr || createElement('p', '空空如也'));
    div.appendChild(h11);
    div.appendChild(JSummary || createElement('p', '空空如也'));
    notice.hide();
 
  new PanelSearchForWord(self, `${word} ${pinyin}`, div || '空空如也', async (type, chatContent) => {
    let file, content, folder: string;
    if (type === 'words') {
      const meanings =
        removeDuplicates(Array.from(jnr.querySelectorAll('.cino, .encs')).map(el => el.parentNode.textContent))
          .map(text => filterChineseAndPunctuation(text))
          .map(text => trimNonChineseChars(text))
          .map(text => text.replace(';', '；'))
          .join('；') || htmlToMarkdown(jnr.textContent);
      content = `${word}\`/${pinyin}/\`：${meanings}。`;
      folder = self.settings.wordsSaveFolder;
    } else if (type === 'card') {
      const html = JSummary?.textContent;
      content = html ? htmlToMarkdown(html) : '';
      content = content.replace(/\[\d+\]/g, '');
      folder = self.settings.cardSaveFolder;
    }

    file = self.app.vault.getMarkdownFiles().find(file => hasRootFolder(file, folder) && file.basename === word);

    if (file) {
      new Notice(type === 'words' ? '词语已存在' : '卡片笔记已存在');
    } else {
      const filepath = `${folder}/${word}.md`;
      file = await self.app.vault.create(filepath, chatContent || content || '');
    }
    editor.replaceSelection(`[[${word}]]`);
    self.app.workspace.getLeaf(true).openFile(file);
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
