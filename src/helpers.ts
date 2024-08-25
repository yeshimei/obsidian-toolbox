import { App, Editor, TFile } from 'obsidian';

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
