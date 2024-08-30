import { App, Editor, TFile, moment, requestUrl, MarkdownView } from 'obsidian';

export function codeBlockParamParse(source: string, separator = '=') {
  return source
    .split('\n')
    .filter(row => row.length > 0)
    .map(row => row.split(separator))
    .reduce((res: any, ret) => {
      res[ret[0]] = ret[1];
      return res;
    }, {});
}

export async function imageToBase64(app: App, file: TFile, action: 'convert' | 'restore', pass: string) {
  const content = await app.vault.read(file);
  const imageRegex = /\[\[(.*?\.(png|jpg|jpeg|gif|bmp|svg))\]\]/g;
  let links = content.match(imageRegex) as string[];
  if (links) {
    links = unique(links).map(text => text.slice(2, -2));
    for (let link of links) {
      const file = app.metadataCache.getFirstLinkpathDest(link, '');
      if (action === 'convert') {
        const arrayBuffer = await app.vault.adapter.readBinary(file.path);
        const base64 = arrayBufferToBase64(arrayBuffer);
        app.vault.modify(file, base64);
      } else if (action === 'restore') {
        const base64 = await app.vault.read(file);
        if (base64) {
          const bytes = convertBase64ToImage(base64);
          await app.vault.adapter.writeBinary(file.path, bytes);
        }
      }
    }
  }
}

function arrayBufferToBase64(buffer: any) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function convertBase64ToImage(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encryptString(str: string, password: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let encrypted = '';
  for (let i = 0; i < data.length; i++) {
    encrypted += String.fromCharCode(data[i] ^ password.charCodeAt(i % password.length));
  }
  return btoa(encrypted);
}

export function decryptString(encodedStr: string, password: string) {
  const decoder = new TextDecoder();
  let str = atob(encodedStr);
  let decrypted = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    decrypted[i] = str.charCodeAt(i) ^ password.charCodeAt(i % password.length);
  }
  return decoder.decode(decrypted);
}
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

export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function uniqueBy<T, U>(arr: T[], key: (item: T) => U): T[] {
  const seen = new Set<U>();
  return arr.filter(item => {
    const keyValue = key(item);
    return seen.has(keyValue) ? false : seen.add(keyValue);
  });
}

export function getBlock(app: App, editor: Editor, file: TFile) {
  const cursor = editor.getCursor('to');
  const fileCache = app.metadataCache.getFileCache(file);
  let block: any = ((fileCache === null || fileCache === void 0 ? void 0 : fileCache.sections) || []).find((section: { position: { start: { line: number }; end: { line: number } } }) => {
    return section.position.start.line <= cursor.line && section.position.end.line >= cursor.line;
  });
  if ((block === null || block === void 0 ? void 0 : block.type) === 'list') {
    block = ((fileCache === null || fileCache === void 0 ? void 0 : fileCache.listItems) || []).find((item: { position: { start: { line: number }; end: { line: number } } }) => {
      return item.position.start.line <= cursor.line && item.position.end.line >= cursor.line;
    });
  } else if ((block === null || block === void 0 ? void 0 : block.type) === 'heading') {
    block = fileCache.headings.find((heading: { position: { start: { line: any } } }) => {
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
