import { App, Editor, MarkdownView, TFile, moment, requestUrl } from 'obsidian';

export const SOURCE_VIEW_CLASS = '.cm-scroller';
export const MASK_CLASS = '.__mask';
export const MOBILE_HEADER_CLASS = '.view-header';
export const MOBILE_NAVBAR_CLASS = '.mobile-navbar-actions';
export const COMMENT_CLASS = '.__comment';
export const OUT_LINK_CLASS = '.cm-underline';
export const imageSuffix = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg'];

export function escapeStringForRegex(str: string) {
  return str.replace(/[-\/\\^$.*+?()[\]{}|]/g, '\\$&');
}

export function hasRootFolder(file: TFile, folderName: string) {
  return new RegExp(`^${folderName}`).test(file.path);
}

/**
 * 获取指定文件夹中作为 option list。
 *
 * @param app - 应用实例。
 * @param folder - 文件夹名称，用于过滤所需的文件。
 * @returns 返回一个包含 option list 名称和对应值的数组，格式为 [{ name: string; value: string }]
 */
export function getOptionList(app: App, folder: string): { name: string; value: string }[] {
  return app.vault
    .getMarkdownFiles()
    .filter(file => hasRootFolder(file, folder))
    .map(file => ({ name: file.basename, value: file.basename }));
}

/**
 * 获取书籍列表，包括当前文件和所有 Markdown 文件
 * @param app - 应用程序实例
 * @returns 返回包含书籍名称和路径的数组
 */
export function getBooksList(app: App, folderName?: string): Array<{ text: any; value: string }> {
  const books = app.vault
    .getMarkdownFiles()
    .filter(file => {
      if (folderName) {
        return file.path.startsWith(folderName + '/');
      }
      return true;
    })
    .map(file => ({
      text: file,
      value: file.path + ' - ' + formatFileSize(file.stat.size)
    }))
    .sort((a, b) => b.text.stat.ctime - a.text.stat.ctime);

  const currentFile = app.workspace.getActiveFile();
  if (currentFile) {
    books.unshift({
      text: currentFile,
      value: currentFile.path + ' - ' + formatFileSize(currentFile.stat.size)
    });
  }

  books.unshift({
    text: null,
    value: '🔗'
  });

  return books;
}

/**
 * 格式化文件大小
 *
 * @param {number} sizeInBytes - 文件大小（以字节为单位）
 * @returns {string} - 格式化后的文件大小字符串，单位可以是 Byte、KB、MB 或 GB
 */
export function formatFileSize(sizeInBytes: number): string {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} Byte`;
  } else if (sizeInBytes < 1024 * 1024) {
    const sizeInKb = (sizeInBytes / 1024).toFixed(2);
    return `${sizeInKb} KB`;
  } else if (sizeInBytes < 1024 * 1024 * 1024) {
    const sizeInMb = (sizeInBytes / (1024 * 1024)).toFixed(2);
    return `${sizeInMb} MB`;
  } else {
    const sizeInGb = (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2);
    return `${sizeInGb} GB`;
  }
}

/**
 * 计算数组中每个字符串出现的次数。
 *
 * @param {string[]} arr - 要统计的字符串数组。
 * @returns {{ [key: string]: number }} - 一个对象，其中键是字符串，值是该字符串在数组中出现的次数。
 */
export function countOccurrences(arr: string[]): [string, number][] {
  const occurrences = arr.reduce((acc, curr) => {
    acc[curr] = (acc[curr] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  return Object.entries(occurrences);
}

export function computerReadingProgress(el: Element) {
  return parseFloat((((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100).toFixed(2));
}

export function insertString(original: string, index: number, insert: string) {
  if (index < 0) {
    index = original.length + index;
  }
  return original.substring(0, index) + insert + original.substring(index);
}
export async function createFile(app: App, path: string, cover = false) {
  let file = app.vault.getFileByPath(path);
  file ? cover && (await app.vault.modify(file, '')) : (file = await app.vault.create(path, ''));
  return file;
}

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

export function editorBlur(app: App) {
  app.workspace.getActiveViewOfType(MarkdownView)?.editor?.blur();
  getSelection().removeAllRanges();
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

export function getBasename(path: string): string {
  return path.split('/').pop() || path;
}

export function pick<T>(array: T[], count: number, unique: boolean = false): T[] {
  const result: T[] = [];
  const usedIndices: Set<number> = new Set();

  for (let i = 0; i < count; i++) {
    let randomIndex: number;

    if (unique) {
      do {
        randomIndex = Math.floor(Math.random() * array.length);
      } while (usedIndices.has(randomIndex));
      usedIndices.add(randomIndex);
    } else {
      randomIndex = Math.floor(Math.random() * array.length);
    }

    result.push(array[randomIndex]);
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

export function generateId() {
  return Math.random().toString(36).substr(2, 6);
}

function shouldInsertAfter(block: any) {
  if (block.type) {
    return ['blockquote', 'code', 'table', 'comment', 'footnoteDefinition'].includes(block.type);
  }
}

// 检查给定的字符串是否为加密笔记
export function isNoteEncrypt(str: string) {
  return /^[a-f0-9]{32}%[a-z0-9:%]+$/.test(str);
}

export function isResourceEncrypt(str: string) {
  return /^[a-z0-9]{24,32}:[a-z0-9]+$/.test(str); /* 分块，记录了 8 位的长度信息 */
}

export function isVideoPath(path: string) {
  return /\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i.test(path);
}

export function isImagePath(path: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(path);
}

export async function isLongScreenshot(arrayBuffer: ArrayBuffer, proportion = 2): Promise<boolean> {
  const blob = new Blob([arrayBuffer]);
  const url = URL.createObjectURL(blob);

  return new Promise(resolve => {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const aspectRatio = img.height / img.width;
      resolve(aspectRatio > proportion);
      URL.revokeObjectURL(url);
    };
  });
}

export function mergeArrayBuffers(buffer1: ArrayBuffer, buffer2: ArrayBuffer): ArrayBuffer {
  const mergedBuffer = new ArrayBuffer(buffer1.byteLength + buffer2.byteLength);
  const mergedView = new Uint8Array(mergedBuffer);

  mergedView.set(new Uint8Array(buffer1), 0);
  mergedView.set(new Uint8Array(buffer2), buffer1.byteLength);

  return mergedBuffer;
}
