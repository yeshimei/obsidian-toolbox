import { App, Editor, TFile, moment, requestUrl, MarkdownView } from 'obsidian';

export function blur(app: App) {
  app.workspace.getActiveViewOfType(MarkdownView)?.editor?.blur();
  getSelection().removeAllRanges();
}

export const plantClassificationSystem: any = {
  被子植物分类系统: `界: 植物界 \n门: 被子植物门`,
  裸子植物分类系统: `界: 植物界 \n门: 裸子植物门`,
  石松类和蕨类植物分类系统: `界: 植物界 \n门: 蕨类植物门`,
  苔藓植物分类系统: `界: 植物界 \n门: 苔藓植物门`
};

export function extractChineseParts(inputString: string) {
  const chineseParts = inputString.match(/[\u4e00-\u9fa5]+/g).reverse();
  const yamlObject: any = {};
  const sy = chineseParts.shift();
  const keys = ['亚门', '纲', '亚纲', '超目', '科', '属'];
  for (let i = 0; i < keys.length; i++) {
    yamlObject[keys[i]] = chineseParts.find(text => text.indexOf(keys[i]) > -1) || '';
  }
  yamlObject['目'] = chineseParts.find(text => text.slice(-1) === '目' && text.slice(-2) !== '超目') || '';
  return `${plantClassificationSystem[sy]}
亚门: ${yamlObject['亚门']}
纲: ${yamlObject['纲']}
亚纲: ${yamlObject['亚纲']}
超目: ${yamlObject['超目']}
科: ${yamlObject['科']}
目: ${yamlObject['目']}
属: ${yamlObject['属']}`;
}

export function $(className: string) {
  return document.querySelector(className) as HTMLElement;
}

export function $$(className: string) {
  return Array.from(document.querySelectorAll(className)) as HTMLElement[];
}

export function ensureMakHide() {
  let mask = document.body.querySelector('.__mask') as HTMLElement;
  return setInterval(() => {
    mask && mask.hide();
  }, 300);
}

export function createElement(t: string, text = '', className = '') {
  const el = document.createElement(t);
  el.className = className;
  el.innerHTML = text;
  return el;
}

export async function requestUrlToHTML(url: string) {
  const content = await requestUrl(url);
  const div = document.createElement('div');
  div.innerHTML = content.text;
  return div;
}

export function filterChineseAndPunctuation(str: string) {
  const regex = /[\u4e00-\u9fa5。，、；;]/g;
  return str.match(regex).join('');
}

export function trimNonChineseChars(str: string) {
  return str.replace(/^[^\u4e00-\u9fa5]+|[^\u4e00-\u9fa5]+$/g, '');
}

export function removeDuplicates<T>(arr: T[]) {
  return arr.filter((item: T, index: number) => arr.indexOf(item) === index);
}

export function pick<T>(arr: T[], n: number = 1, repeat = true): T[] {
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

export function debounce(fn: Function, delay: number = 500) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (...args: any[]) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

export function today(more = false) {
  return moment().format('YYYY-MM-DD' + (more ? ' hh:mm:ss' : ''));
}

export function msTo(t: number) {
  let duration = moment.duration(t);
  let hours = Math.floor(duration.asHours());
  let minutes = duration.minutes();
  let seconds = duration.seconds();
  return `${hours ? hours + 'h' : ''}${minutes ? minutes + 'm' : ''}${seconds ? seconds + 's' : ''}`;
}

export function uniqueBy<T, K extends keyof T>(arr: T[], key: K): T[] {
  const map = new Map<T[K], T>();
  return arr.filter(item => {
    return map.has(item[key]) ? false : map.set(item[key], item);
  });
}

export function getBlock(app: App, editor: Editor, file: TFile) {
  const cursor = editor.getCursor('to');
  const fileCache = app.metadataCache.getFileCache(file);
  let block: any = ((fileCache === null || fileCache === void 0 ? void 0 : fileCache.sections) || []).find(section => {
    return section.position.start.line <= cursor.line && section.position.end.line >= cursor.line;
  });
  if ((block === null || block === void 0 ? void 0 : block.type) === 'list') {
    block = ((fileCache === null || fileCache === void 0 ? void 0 : fileCache.listItems) || []).find(item => {
      return item.position.start.line <= cursor.line && item.position.end.line >= cursor.line;
    });
  } else if ((block === null || block === void 0 ? void 0 : block.type) === 'heading') {
    block = fileCache.headings.find(heading => {
      return heading.position.start.line === block.position.start.line;
    });
  }

  let blockId = block.id;
  if (!blockId) {
    const sectionEnd = block.position.end;
    const end = {
      ch: sectionEnd.col,
      line: sectionEnd.line
    };
    const id = generateId();
    const spacer = shouldInsertAfter(block) ? '\n\n' : ' ';
    editor.replaceRange(`${spacer}^${id}`, end);
    blockId = id;
  }
  return blockId;
}

function generateId() {
  return Math.random().toString(36).substr(2, 6);
}

function shouldInsertAfter(block: any) {
  if (block.type) {
    return ['blockquote', 'code', 'table', 'comment', 'footnoteDefinition'].includes(block.type);
  }
}
