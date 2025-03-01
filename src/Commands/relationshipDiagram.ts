import { Editor, ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import { render } from 'src/helpers';
import Toolbox from 'src/main';

let gitChartData: any;
let self: Toolbox;

export default function relationshipDiagramCommand(f: Toolbox) {
  self = f;
  self.settings.highlight &&
    self.addCommand({
      id: '打开关系图',
      name: '打开关系图',
      icon: 'git-compare-arrows',
      editorCallback: (editor, view) => relationshipDiagram(editor, view.file)
    });
}

async function relationshipDiagram(editor: Editor, file: TFile) {
  const content = await self.app.vault.read(file);
  const filename = file.basename;
  const lineText = getCursorText(editor);
  const { name } = parseLine(lineText);
  const tree = await processTree(content, name);
  gitChartData = tree;
  const text = generateGitgraphFromList(tree, filename);
  await createTempRelationGraph(name || filename, text);
}

function generateGitgraphFromList(tree: any, title: string) {
  tree = {
    children: [
      {
        name: title,
        branchName: title,
        children: tree.children
      }
    ]
  };

  const commands = [
    `\`\`\`mermaid
---
title: ${tree.children[0].name}
---
%%%{init: {'gitGraph': {'rotateCommitLabel': false}} }%%%
gitGraph TB:`
  ];

  for (const mainNode of tree.children) {
    if (mainNode.children.length > 0) {
      processBranch(mainNode, commands);
    }
  }
  return commands.slice(0, -1).join('\n') + '\n```';
}

async function joinTree(node: any) {
  for (let child of node.children) {
    if (child.type === '==') {
      const [filename, id] = child.link.split('#^');
      const file = self.getFileByShort(filename);
      if (file) {
        const content = await self.app.vault.read(file);
        const r = parseListToTree(content);
        const d = findTree(r, id, 'id');
        if (d) {
          child.children = d.children;
        }
      }
    }

    if (child.children.length > 0) {
      await joinTree(child);
    }
  }
}

function processBranch(node: any, cmds: any) {
  const branchName = node.children[0].branchName;
  cmds.push(`  branch "${branchName}"`);
  for (const child of node.children) {
    cmds.push(`  commit id: "${child.name}"${child.children.length > 0 ? 'type: REVERSE' : ''}`);
    if (child.children.length > 0) {
      const childBranch = child.children[0].branchName;
      cmds.push(`  branch "${childBranch}"`);
      processChildren(child, cmds);
    }
  }
  cmds.push(`  checkout "${node.branchName}"`);
}

function processChildren(node: any, cmds: any) {
  for (const child of node.children) {
    cmds.push(`  commit id: "${child.name}"${child.children.length > 0 ? 'type: REVERSE' : ''}`);
    if (child.children.length > 0) {
      const childBranch = child.children[0].branchName;
      cmds.push(`  branch "${childBranch}"`);
      processChildren(child, cmds);
      cmds.push(`  checkout "${child.branchName}"`);
    }
  }
  cmds.push(`  checkout "${node.branchName}"`);
}

async function processTree(listStr: string, name?: string) {
  let tree = parseListToTree(listStr);
  tree = name ? findTree(tree, name) : tree;
  await joinTree(tree);
  console.log(tree);
  return tree;
}

function parseListToTree(str: string) {
  const lines = str.split('\n').filter(l => l.trim());
  const root: any = { children: [] };
  const stack = [{ node: root, level: -1 }];
  for (const line of lines) {
    let { level, name, type, link, id } = parseLine(line);
    if (!name) continue;

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;
    const newNode: any = { id, name, level, type, link, children: [], branchName: parent?.name || '默认', parent };
    parent.children.push(newNode);
    stack.push({ node: newNode, level });
  }
  return root;
}

function findTree(originalRoot: any, targetName: string, key = 'name'): any {
  for (const child of originalRoot.children) {
    if (child[key] === targetName) return child;
    if (child.children.length > 0) {
      const found = findTree(child, targetName, key);
      if (found) return found;
    }
  }
  return null;
}

function getFlattenedPath(tree: any, targetName: string): any {
  function findPath(node: any, currentPath: any[]) {
    const newPath = [...currentPath, node];
    if (node.name === targetName) {
      return newPath;
    }
    for (const child of node.children) {
      const result = findPath(child, newPath) as any;
      if (result) return result;
    }
    return null;
  }
  for (const child of tree.children) {
    const path = findPath(child, []);
    if (path) {
      return path.map((tree: any) => ({
        ...tree,
        children: []
      }));
    }
  }
  return null;
}

function getCursorText(editor: Editor): string {
  const cursor = editor.getCursor();
  const lineText = editor.getLine(cursor.line);
  return lineText;
}

function parseLine(line: string) {
  const level = line.match(/^(\t*)/)[0].length;

  let content = line.replace(/^[\t]*-[\t]*/, '').trim();
  const isMark = /==.*?\[\[.*?#\^\w{6}(?:|.*?)\]\].*?==/.test(content);
  content = content.replace(/^\s*(?:.*?)(\[\[.*?\]\])\s*(?:.*?)(\^[0-9a-z]{6})?\s*$/, (match, p1, p2) => {
    p1 = isMark ? `==${p1}==` : p1;
    return p2 ? `${p1} ${p2}` : p1;
  });

  const regex = /^(=*)\[\[([^|#]+(?:#[^|]*)?)(?:\|([^\]]+))?\]\]\1(?:\s*\^([^\s=]+))?$|^([^[\]]+)$/;
  const match = content.match(regex);
  if (!match) return { type: 'plain', level, name: content };
  if (match[5]) return { type: 'plain', level, name: match[5] };
  const [, type, link, name, id] = match;
  return {
    id,
    type: type || 'link',
    level,
    link,
    name: name || link
  };
}

async function createTempRelationGraph(title: string, content: string) {
  const tempViewType = String(Date.now());

  self.app.workspace.detachLeavesOfType(tempViewType);

  const leaf = self.app.workspace.getLeaf('tab');
  await leaf.setViewState({
    type: tempViewType,
    active: true
  });

  self.registerView(tempViewType, (leaf: WorkspaceLeaf) => new TempRelationView(leaf, title, content) as any);
  self.app.workspace.revealLeaf(leaf);
}

/* 自定义视图 */

class TempRelationView extends ItemView {
  title: string;
  content: string;
  zoom: ZoomDrag;
  splitLeaf: WorkspaceLeaf | null = null;
  constructor(leaf: WorkspaceLeaf, title: string, content: string) {
    super(leaf);
    this.title = title;
    this.content = content;
  }

  getViewType(): string {
    return this.title;
  }

  getDisplayText(): string {
    return `关系图: ${this.title}`;
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    const contentEl = container.createDiv('temp-relation-content');
    contentEl.style.overflow = 'visible';
    contentEl.addEventListener('click', this.onclick.bind(this));
    contentEl.addEventListener('mouseover', this.onmouseover.bind(this));
    contentEl.addEventListener('mouseout', this.onmouseout.bind(this));

    await render(self.app, this.content, contentEl);
    this.zoom = new ZoomDrag(contentEl);
  }

  async onClose() {
    this.splitLeaf.detach();
    this.containerEl.children[1].empty();
    this.zoom.destroy();
  }

  async onclick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.hasClass('commit-label')) return;
    const name = target.textContent;
    if (!name) return;
    if (e.ctrlKey) this.truncation(name);
    else if (e.altKey) this.logicalChain(name);
    else this.openLink(name);
  }

  onmouseover(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.hasClass('commit-label')) return;
    const name = target.textContent;
    if (!name) return;
    const link = this.getLink(gitChartData, name);
    if (!link) return;
    target.style.textDecorationLine = 'underline';
    target.style.cursor = 'pointer';
  }

  onmouseout(e: Event) {
    const target = e.target as HTMLElement;
    if (!target.hasClass('commit-label')) return;
    target.style.textDecorationLine = 'none';
  }

  async openLink(name: string) {
    const link = this.getLink(gitChartData, name);
    const currentFile = self.app.workspace.getActiveFile();
    if (currentFile && link) {
      if (!this.app.workspace.getLeafById(this.splitLeaf?.id)) {
        this.splitLeaf = this.app.workspace.getLeaf('split');
      }
      const leaf = this.splitLeaf;
      await self.app.workspace.openLinkText(link, currentFile.path, false, {
        group: leaf,
        active: true
      });
      this.splitLeaf = leaf;
    }
  }

  logicalChain(name: string) {
    let tree = getFlattenedPath(gitChartData, name);
    if (!tree) return;
    createTempRelationGraph(name, generateGitgraphFromList({ children: tree }, name));
  }

  truncation(name: string) {
    let tree = findTree(gitChartData, name);
    if (!tree) return;
    createTempRelationGraph(name, generateGitgraphFromList(tree, name));
  }

  getLink(nodes: any, name: string): string {
    return findTree(nodes, name)?.link;
  }

  traverseDom(root: any, fn: (el: HTMLElement) => void, className = 'commit-label') {
    const names = root.children.map((child: any) => child.name);
    document.querySelectorAll(`.${className}`).forEach((el: HTMLElement) => {
      const name = el.textContent;
      if (names.includes(name)) {
        fn(el);
      }
    });
  }
}

/* 缩放 & 拖拽 */

interface ZoomDragState {
  scale: number;
  x: number;
  y: number;
  isDragging: boolean;
  startX: number;
  startY: number;
  lastTouchDistance: number | null;
}

interface HTMLElementWithZoomDragState extends HTMLElement {
  zoomDragState?: ZoomDragState;
}

type EventHandlerEntry = {
  type: string;
  handler: EventListener;
  options?: boolean | AddEventListenerOptions;
};

class ZoomDrag {
  elements: HTMLElement[];
  elementEventHandlers = new WeakMap<HTMLElement, EventHandlerEntry[]>();

  constructor(element: HTMLElement) {
    this.elements = [element];
    this.initEvents();
  }

  initEvents(): void {
    this.elements.forEach(element => {
      // 初始化变换状态
      (element as HTMLElementWithZoomDragState).zoomDragState = {
        scale: 1,
        x: 0,
        y: 0,
        isDragging: false,
        startX: 0,
        startY: 0,
        lastTouchDistance: null
      };

      const eventHandlers: EventHandlerEntry[] = [];

      // 桌面端事件
      const wheelHandler = this.handleWheel.bind(this);
      element.addEventListener('wheel', wheelHandler);
      eventHandlers.push({ type: 'wheel', handler: wheelHandler });

      const mouseDownHandler = this.handleMouseDown.bind(this);
      element.addEventListener('mousedown', mouseDownHandler);
      eventHandlers.push({ type: 'mousedown', handler: mouseDownHandler });

      const contextMenuHandler = (e: Event) => e.preventDefault();
      element.addEventListener('contextmenu', contextMenuHandler);
      eventHandlers.push({ type: 'contextmenu', handler: contextMenuHandler });

      // 移动端事件
      const touchStartHandler = this.handleTouchStart.bind(this);
      element.addEventListener('touchstart', touchStartHandler);
      eventHandlers.push({ type: 'touchstart', handler: touchStartHandler });

      const touchMoveHandler = this.handleTouchMove.bind(this);
      element.addEventListener('touchmove', touchMoveHandler, { passive: false });
      eventHandlers.push({ type: 'touchmove', handler: touchMoveHandler, options: { passive: false } });

      const touchEndHandler = this.handleTouchEnd.bind(this);
      element.addEventListener('touchend', touchEndHandler);
      eventHandlers.push({ type: 'touchend', handler: touchEndHandler });

      this.elementEventHandlers.set(element, eventHandlers);
    });
  }

  handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const element = e.currentTarget as HTMLElementWithZoomDragState;
    const state = element.zoomDragState!;
    const rect = element.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    const newScale = state.scale * delta;

    if (newScale < 0.1 || newScale > 100) return;

    state.x = mouseX - (mouseX - state.x) * delta;
    state.y = mouseY - (mouseY - state.y) * delta;
    state.scale = newScale;

    this.applyTransform(element);
  }

  handleMouseDown(e: MouseEvent): void {
    if (e.button === 2 || (e.button === 0 && e.code === 'Space')) {
      const element = e.currentTarget as HTMLElementWithZoomDragState;
      const state = element.zoomDragState!;

      state.isDragging = true;
      state.startX = e.clientX - state.x;
      state.startY = e.clientY - state.y;

      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
    }
  }

  handleMouseMove = (e: MouseEvent): void => {
    this.elements.forEach(element => {
      const state = (element as HTMLElementWithZoomDragState).zoomDragState!;
      if (state.isDragging) {
        state.x = e.clientX - state.startX;
        state.y = e.clientY - state.startY;
        this.applyTransform(element);
      }
    });
  };

  handleMouseUp = (): void => {
    this.elements.forEach(element => {
      (element as HTMLElementWithZoomDragState).zoomDragState!.isDragging = false;
    });
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  };

  handleTouchStart(e: TouchEvent): void {
    e.stopImmediatePropagation();
    const element = e.currentTarget as HTMLElementWithZoomDragState;
    const state = element.zoomDragState!;
    const touches = e.touches;

    if (touches.length === 1) {
      state.isDragging = true;
      state.startX = touches[0].clientX - state.x;
      state.startY = touches[0].clientY - state.y;
    } else if (touches.length === 2) {
      state.lastTouchDistance = this.getTouchDistance(touches);
      const center = this.getTouchCenter(touches);
      state.startX = center.x - state.x;
      state.startY = center.y - state.y;
    }
  }

  handleTouchMove(e: TouchEvent): void {
    e.stopImmediatePropagation();
    const element = e.currentTarget as HTMLElementWithZoomDragState;
    const state = element.zoomDragState!;
    const touches = e.touches;

    if (touches.length === 1 && state.isDragging) {
      state.x = touches[0].clientX - state.startX;
      state.y = touches[0].clientY - state.startY;
      this.applyTransform(element);
    } else if (touches.length === 2) {
      const currentDistance = this.getTouchDistance(touches);
      const delta = currentDistance / state.lastTouchDistance!;

      const center = this.getTouchCenter(touches);

      const newScale = state.scale * delta;
      if (newScale < 0.1 || newScale > 5) return;

      state.x = center.x - (center.x - state.x) * delta;
      state.y = center.y - (center.y - state.y) * delta;
      state.scale = newScale;
      state.lastTouchDistance = currentDistance;

      this.applyTransform(element);
    }
  }

  handleTouchEnd(): void {
    this.elements.forEach(element => {
      const state = (element as HTMLElementWithZoomDragState).zoomDragState!;
      state.isDragging = false;
      state.lastTouchDistance = null;
    });
  }

  applyTransform(element: HTMLElement): void {
    const state = (element as HTMLElementWithZoomDragState).zoomDragState!;
    element.style.transformOrigin = '50% 50%';
    element.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
  }

  getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getTouchCenter(touches: TouchList): { x: number; y: number } {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  public destroy(): void {
    this.elements.forEach(element => {
      const handlers = this.elementEventHandlers.get(element);
      if (handlers) {
        handlers.forEach(({ type, handler, options }) => {
          element.removeEventListener(type, handler, options);
        });
      }

      // 清理扩展属性
      delete (element as HTMLElementWithZoomDragState).zoomDragState;
    });

    // 清理文档级事件
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }
}
