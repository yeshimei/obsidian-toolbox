import { Editor, Notice, TFile } from 'obsidian';
import { $, computerReadingProgress, createElement, getBlock, hasRootFolder, SOURCE_VIEW_CLASS } from 'src/helpers';
import Toolbox from 'src/main';

export default function createCharacterRelationshipCommand(self: Toolbox) {
  self.settings.characterRelationships &&
    self.addCommand({
      id: '创建人物关系',
      name: '创建人物关系',
      icon: 'clipboard-check',
      editorCallback: (editor, view) => createCharacterRelationship(self, editor, view.file)
    });
}

export async function switchCharacterRelationship(self: Toolbox, file: TFile) {
  if (!hasRootFolder(file, self.settings.characterRelationshipsFolder)) return;
  document.onclick = evt => {
    const target = evt.target as HTMLElement;
    if (target.hasClass('__character-relationship__')) {
      const { id, path, title, progress } = target.dataset;
      characterRelationship(self, file, title, path, id, Number(progress));
    }
  };
}

async function createCharacterRelationship(self: Toolbox, editor: Editor, file: TFile) {
  if (!self.hasReadingPage(file)) return;
  const readingProgress = Number(self.getMetadata(file, 'readingProgress'));
  const title = self.getMetadata(file, 'title');
  if (readingProgress <= 0 || isNaN(readingProgress)) {
    new Notice(`《${file.basename}》还未阅读`);
    return;
  }

  // 创建人物关系笔记
  const targetPath = `${self.settings.characterRelationshipsFolder}/${title}.md`;
  let targetFile = self.app.vault.getFileByPath(targetPath);
  if (!targetFile) {
    targetFile = await self.app.vault.create(targetPath, '');
  }

  // 把光标所在行的标题结构变为面包屑标题
  const headings = self.app.metadataCache.getFileCache(file)?.headings || [];
  const position = editor.getCursor();
  const hierarchy = getHeadingHierarchy(headings, position.line);
  const headingText = hierarchy.reduce((res, ret) => (res += ret.heading + '/'), '').slice(0, -1);

  // 人物关系笔记的内容
  let blockId = getBlock(self.app, editor, file) as string;
  const progress = computerReadingProgress($(SOURCE_VIEW_CLASS));
  await characterRelationship(self, targetFile, headingText, file.path, blockId, progress);
  await self.app.workspace.getLeaf(true).openFile(targetFile);
}

async function characterRelationship(self: Toolbox, file: TFile, title: string, path: string, id: string, progress: number) {
  let content = await self.app.vault.read(file);
  let els = createElement('div', content).querySelectorAll('.__character-relationship__') as any;
  if (els.length === 0) {
    if (content) {
      new Notice('人物关系笔记已通过其他方式创建');
      return;
    }

    content = `---\ntags: 人物关系\n---\n\n- [${title}](${path}#^${id}) - <span class="__character-relationship__ cm-highlight" data-id="${id}" data-path="${path}" data-title="${title}" data-progress="${progress}" data-content="" data-state="open">${progress}%</span>\n\n\`\`\`mermaid\nflowchart LR\n\`\`\``;
  } else {
    let mermaid = content.match(/^```mermaid[\s\S]+```/gm)[0];
    els = Array.from(els).map((el: any) => {
      const { id, path, title, progress, content, state } = el.dataset;
      return {
        id,
        path,
        title,
        progress: Number(progress),
        content: state === 'open' ? mermaid : content.replace(/\\n/g, '\n'),
        state: 'close'
      };
    });
    const index = els.findIndex((item: any) => item.progress >= progress);
    const value = {
      id,
      path,
      title,
      progress: Number(progress),
      content: '',
      state: 'open'
    };

    mermaid = `\n\n\`\`\`mermaid\nflowchart LR\n\`\`\``;
    if (els[index]?.progress === progress) {
      els[index].state = 'open';
      mermaid = els[index].content;
    } else if (index > -1) {
      els.splice(index, 0, value);
    } else {
      els.push(value);
    }

    mermaid = mermaid.replace(/\\n/g, '\n');
    content = `---\ntags: 人物关系\n---\n\n${els.map((el: any) => `- [${el.title}](${el.path}#^${el.id}) - <${el.state === 'open' ? 'mark' : 'span'} class="__character-relationship__ ${el.state === 'open' ? 'cm-highlight' : ''}" data-id="${el.id}" data-path="${el.path}" data-title="${el.title}" data-progress="${el.progress}" data-content=${JSON.stringify(el.content)} data-state="${el.state}">${el.progress}%</${el.state === 'open' ? 'mark' : 'span'}>`).join('\n')}\n\n${mermaid}`;
  }

  self.app.vault.modify(file, content);
}

/**
 * 获取指定行所在的标题层级
 * @param headings 标题数组
 * @param line 指定行号
 * @returns 标题层级数组
 */
function getHeadingHierarchy<T extends { [key: string]: any }>(headings: T[], line: number): T[] {
  let currentHeading: T;
  const hierarchy: T[] = [];

  for (let i = headings.length - 1; i >= 0; i--) {
    if (headings[i].position.start.line <= line) {
      currentHeading = headings[i];
      break;
    }
  }

  if (!currentHeading) {
    return hierarchy;
  }

  hierarchy.push(currentHeading);

  for (let i = headings.indexOf(currentHeading) - 1; i >= 0; i--) {
    if (headings[i].level < currentHeading.level) {
      hierarchy.unshift(headings[i]);
      currentHeading = headings[i];
    }
  }

  return hierarchy;
}
