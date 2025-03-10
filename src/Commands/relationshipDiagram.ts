import { Editor, ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import { render } from 'src/helpers';
import Toolbox from 'src/main';

let self: Toolbox;

export default function relationshipDiagramCommand(f: Toolbox) {
  self = f;
  self.settings.gitChart &&
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
  const text = generateGitgraphFromList(tree, filename);
  await createTempRelationGraph(name || filename, text, tree);
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

async function joinTree(node: any, root: any) {
  for (let child of node.children) {
    if (child.type === '+') {
      const [filename, id] = child.link.split('#^');
      const file = self.getFileByShort(filename);
      if (file) {
        const content = await self.app.vault.read(file);
        const r = parseListToTree(content);
        const d = findTree(r, id, 'id');
        if (d) {
          d.parent = child
          child.children = d.children;
          removeTree(root, id, 'id')
        }
      }
    }

    if (child.children.length > 0) {
      await joinTree(child, root);
    }
  }
}

function processBranch(node: any, cmds: any) {
  const branchName = node.children[0].branchName;
  cmds.push(`  branch "${branchName}"`);
  for (const child of node.children) {
    cmds.push(`  commit id: "${child.name}"${child.children.length > 0 ? 'type: REVERSE' : ''} ${child.tag ? `tag: "${child.tag}"` : ''}`);
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
    cmds.push(`  commit id: "${child.name}"${child.children.length > 0 ? 'type: REVERSE' : ''} ${child.tag ? `tag: "${child.tag}"` : ''}`);
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
  tree = name ? { children: [findTree(tree, name)] } : tree;
  await joinTree(tree, tree);
  return tree;
}

function parseListToTree(str: string) {
  const lines = str.split('\n').filter(l => l.trim());
  const root: any = { children: [] };
  const stack = [{ node: root, level: -1 }];
  for (const line of lines) {
    let lineData = parseLine(line);
    const { level, name } = lineData
    if (!name) continue;

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;
    const newNode: any = Object.assign({}, lineData, {children: [], branchName: parent?.branchId || 'default', parent: level === 0 ? null : parent})
    parent.children.push(newNode);
    stack.push({ node: newNode, level });
  }
  return root;
}

function updateTreeCollapseState(tree: any, hideBranchNames: string[]) {
  function traverse(node: any) {
    
    if (hideBranchNames.includes(node.name)) {
      node._children = node._children || node.children;
      node.children = [];
    } else if (node._children) {
      node.children = node._children;
      delete node._children;
    }

    const childrenToTraverse = node._children || node.children;
    for (const child of childrenToTraverse) {
      traverse(child);
    }
  }
  traverse(tree);
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

function removeTree(originalRoot: any, targetName: string, key = 'name'): any {
  for (let i = 0; i < originalRoot.children.length; i++) {
    const child = originalRoot.children[i];
    if (child[key] === targetName) {
      originalRoot.children.splice(i, 1);
      return child;
    }
    if (child.children.length > 0) {
      const found = removeTree(child, targetName, key);
      if (found) return found;
    }
  }
  return null;
}

function getFlattenedPath (tree: any, targetName: string) {
  const paths = []
  const target = findTree(tree, targetName)
  let node = target
  while(node.parent) {
    paths.push(node.parent)
    node = node.parent
  }
  paths.unshift(target)
  paths.forEach(node => node.children = [])
  paths.reverse()
  return paths  
}

function getCursorText(editor: Editor): string {
  const cursor = editor.getCursor();
  const lineText = editor.getLine(cursor.line);
  return lineText;
}

function parseLine(line: string) {
  const level = line.match(/^(\t*)/)[0].length;
  const branchId = Math.random().toString(16).slice(2);
  let content = line.replace(/^[\t]*-[\t]*/, '').trim();
  const isMark = /==.*?\[\[.*?#\^\w{6}(?:|.*?)\]\].*?==/.test(content);
  let type
  if (/^\[.\](?!\])/.test(content)) {
    type = content[1]
    content = content.slice(3).trim()
  } 

  const tag = content.match(/ #(\S+)/)?.[1]
  if (tag) content = content.replace(` #${tag}`, '')
  content = content.replace(/^\s*(?:.*?)(\[\[.*?\]\])\s*(?:.*?)(\^[0-9a-z]{6})?\s*$/, (match, p1, p2) => {
    p1 = isMark ? `==${p1}==` : p1;
    return p2 ? `${p1} ${p2}` : p1;
  })

  const regex = /^(=*)\[\[([^|#]+(?:#[^|]*)?)(?:\|([^\]]+))?\]\]\1(?:\s*\^([^\s=]+))?$|^([^[\]]+)$/;
  const match = content.match(regex);
  if (!match) return { type, level, name: content, tag, branchId };
  if (match[5]) return { type, level, name: match[5], tag, branchId };
  const [, , link, name, id] = match;
  return {
    id,
    tag,
    type: type || 'link',
    level,
    link,
    name: name || link,
    branchId
  };
}

async function createTempRelationGraph(title: string, content: string, gitChartData: any) {
  const tempViewType = String(Date.now());

  self.app.workspace.detachLeavesOfType(tempViewType);

  const leaf = self.app.workspace.getLeaf('tab');
  await leaf.setViewState({
    type: tempViewType,
    active: true
  });

  self.registerView(tempViewType, (leaf: WorkspaceLeaf) => new TempRelationView(leaf, title, content, gitChartData) as any);
  self.app.workspace.revealLeaf(leaf);
}

/* 自定义视图 */

class TempRelationView extends ItemView {
  title: string;
  content: string;
  viewEl: HTMLElement;
  zoom: ZoomDrag;
  splitLeaf: WorkspaceLeaf | null = null;
  gitChart: any;
  hideBranchNames: string[] = [];
  constructor(leaf: WorkspaceLeaf, title: string, content: string, gitChart: any) {
    super(leaf);
    this.title = title;
    this.content = content;
    this.gitChart = gitChart;
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
    this.viewEl = contentEl;
    await render(self.app, this.content, contentEl);
    this.zoom = new ZoomDrag(contentEl);
    this.multicolorLabel()
  }

  async onClose() {
    this.splitLeaf?.detach();
    this.containerEl.children[1].empty();
    this.zoom.destroy();
  }

  async onclick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.hasClass('commit-label')) {
      const name = target.textContent;
      if (!name) return;
      if (e.ctrlKey) this.truncation(name);
      else if (e.altKey) this.logicalChain(name);
      else this.openLink(name);
    } if (target.hasClass('commit')) {
      const target = e.target as HTMLElement;
      const name = target.classList[target.classList.length - 2];
      if (!name) return;
      this.exhibitionBranch(name);
    }
  }

  onmouseover(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.hasClass('commit-label')) return;
    const name = target.textContent;
    if (!name) return;
    const link = this.getLink(this.gitChart, name);
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
    const link = this.getLink(this.gitChart, name);
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

  async exhibitionBranch (name: string) {
    this.hideBranchNames = this.hideBranchNames.includes(name) ? this.hideBranchNames.filter(n => n!== name) : [...this.hideBranchNames, name];
    updateTreeCollapseState(this.gitChart, this.hideBranchNames)
    const content = generateGitgraphFromList(this.gitChart, this.title)
    this.viewEl.empty()
    await render(self.app, content, this.viewEl);
    this.multicolorLabel()
  }

  logicalChain(name: string) {
    let tree = getFlattenedPath(deepClone(this.gitChart), name);
    if (!tree) return;
    createTempRelationGraph(name, generateGitgraphFromList({ children: tree }, name), tree);
  }

  truncation(name: string) {
    const copy = deepClone(this.gitChart)
    updateTreeCollapseState(copy, [])
    let tree = findTree(copy, name);
    if (!tree) return;
    createTempRelationGraph(name, generateGitgraphFromList({ children: [tree] }, name), tree);
  }

  getLink(nodes: any, name: string): string {
    return findTree(nodes, name)?.link;
  }

  multicolorLabel () {
    if (!self.settings.gitChartMultiColorLabel) return
    const labels = document.querySelectorAll('.commit-label')
    labels.forEach((label: HTMLElement) => {
      const name = label.textContent
      const validSelector = `.${CSS.escape(name.split(' ').pop())}`;
      const commit = document.querySelector(validSelector)
      if (!commit) return
      const color = getComputedStyle(commit).fill
      if (color) label.style.fill = color
    })
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


function deepClone<T>(obj: T, map = new WeakMap()): T {
  // 处理非对象或null的情况
  if (typeof obj !== 'object' || obj === null) {
      return obj;
  }

  // 处理循环引用
  if (map.has(obj)) {
      return map.get(obj);
  }

  // 处理特殊对象类型
  const objType = Object.prototype.toString.call(obj);
  switch (objType) {
      case '[object Date]':
          const date = obj as unknown as Date;
          return new Date(date) as unknown as T;
          
      case '[object RegExp]': {
          const regexp = obj as unknown as RegExp;
          const newRegExp = new RegExp(regexp.source, regexp.flags);
          newRegExp.lastIndex = regexp.lastIndex;
          return newRegExp as unknown as T;
      }
          
      case '[object Map]': {
          const mapObj = obj as unknown as Map<any, any>;
          const cloneMap = new Map();
          map.set(obj, cloneMap);
          mapObj.forEach((value, key) => {
              cloneMap.set(deepClone(key, map), deepClone(value, map));
          });
          return cloneMap as unknown as T;
      }
          
      case '[object Set]': {
          const setObj = obj as unknown as Set<any>;
          const cloneSet = new Set();
          map.set(obj, cloneSet);
          setObj.forEach(value => {
              cloneSet.add(deepClone(value, map));
          });
          return cloneSet as unknown as T;
      }
  }

  // 处理数组和普通对象
  const clone: any = Array.isArray(obj) ? [] : {};
  map.set(obj, clone);

  // 使用Reflect.ownKeys获取所有自有属性（包括Symbol）
  Reflect.ownKeys(obj).forEach(key => {
      clone[key] = deepClone((obj as any)[key], map);
  });

  return clone;
}
