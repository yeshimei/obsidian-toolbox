import { Editor, ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import { render } from 'src/helpers';
import Toolbox from 'src/main';

let self: Toolbox;
let separator = getId();
let hideBranchNames: string[] = [];
let filename = '';

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
  filename = file.basename;
  const tree = await processTree(content);
  const part = getPart(editor, tree)
  const treePart = part ? { children: [part] } : tree;
  const name = part ? treePart.children[0].name : filename;
  const context = partition(treePart, name);
  await createTempRelationGraph(name, context, tree, treePart);
}


function getPart (editor: Editor, tree: any) {
  const cursor = editor.getCursor();
  let line = cursor.line;
  let lineText = editor.getLine(cursor.line);
  let type  = parseLine(lineText).type
    while (type === 'l' || type === '%') {
      line++
      lineText = editor.getLine(line);
      type = parseLine(lineText).type
    }
  return findTree(tree, line, 'line')
}


function partition(tree: any, title: string, folding = true) {
  if (self.settings.gitChartPartition && title === filename) {
    let content = '';

    if (self.settings.gitChartPartitionFolding && folding) {
      hideBranchNames = tree.children.map((node: any) => node.branchId);
      updateTreeCollapseState(tree, hideBranchNames);
    }

    tree.children.forEach((node: any) => {
      content += generateGitgraphFromList({ children: [node] }, title);
    });
    return content;
  } else {
    return generateGitgraphFromList(tree, title);
  }
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
  return commands.slice(0, -1).join('\n') + '\n```\n\n';
}

function transformChainNotIncludingOneself(child: any, i: number, parent: any) {
  transformChain(child);
  placeholder(child, i, parent);
}

function transformChain(child: any): void {
  const children = child.children;
  for (let i = 0; i < children.length - 1; i++) {
    const currentNode = children[i];
    const nextNode = children[i + 1];
    currentNode.children.push(nextNode);
    nextNode.parent = currentNode;
    nextNode.branchName = currentNode.branchId;
    nextNode.level = currentNode.level + 1;
  }
  child.children = [child.children[0]].filter(Boolean);
}

function placeholder(child: any, i: number, parent: any) {
  parent.children.splice(i, 1, ...child.children);
  child.children.forEach((c: any) => {
    c.parent = parent;
    c.level--;
    c.branchName = parent.branchId;
  });
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
          d.parent = child;
          child.children = child.children.concat(d.children);
          child.link = d.link
          child.children.forEach((c: any) => {
            c.parent = child;
            c.branchName = child.branchId;
          });
          removeTree(root, id, 'id');
        }
      }
    }

    if (child.children.length > 0) {
      await joinTree(child, root);
    }
  }
}

function forEachTree(node: any, type: string, callback: Function) {
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (child.type === type) {
      callback(child, i, node);
    }

    if (child.children.length > 0) {
      forEachTree(child, type, callback);
    }
  }
}

function commit(child: any) {
  return `  commit id: "${child.name}${separator}${child.link || ''}${separator}${child.id || ''}${separator}${child.type || ''}${separator}${child.tag || ''}${separator}${child.branchName}${separator}${child.branchId}${separator}${child.level}${separator}${child.parent?.name || ''}${separator}${child.children.length}" ${child.children.length > 0 ? 'type: REVERSE' : ''} ${child.tag ? `tag: "${child.tag}"` : ''}`;
}

function processBranch(node: any, cmds: any) {
  const branchName = node.children[0].branchName;
  cmds.push(`  branch "${branchName}"`);
  for (const child of node.children) {
    cmds.push(commit(child));
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
    cmds.push(commit(child));
    if (child.children.length > 0) {
      const childBranch = child.children[0].branchName;
      cmds.push(`  branch "${childBranch}"`);
      processChildren(child, cmds);
      cmds.push(`  checkout "${child.branchName}"`);
    }
  }
  cmds.push(`  checkout "${node.branchName}"`);
}

async function processTree(listStr: string) {
  let tree = parseListToTree(listStr);
  await joinTree(tree, tree);
  forEachTree(tree, '%', placeholder);
  forEachTree(tree, 'i', transformChain);
  forEachTree(tree, 'l', transformChainNotIncludingOneself);
  return tree;
}

function parseListToTree(str: string) {
  const lines = str.split('\n');
  const root: any = { children: [] };
  const stack = [{ node: root, level: -1 }];
  for (const [i, line] of Array.from(lines).entries()) {
    if (line.trim() === '') continue;
    let lineData = parseLine(line);
    const { level, name } = lineData;
    if (!name) continue;

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;
    const newNode: any = Object.assign({}, lineData, { line: i, children: [], branchName: parent?.branchId || 'default', parent: level === 0 ? null : parent });
    parent.children.push(newNode);
    stack.push({ node: newNode, level });
  }
  return root;
}

function updateTreeCollapseState(tree: any, hideBranchNames: string[]) {
  function traverse(node: any) {
    if (hideBranchNames.includes(node.branchId)) {
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

function findTree(originalRoot: any, targetName: any, key = 'name'): any {
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

function getFlattenedPath(tree: any) {
  const paths = [];
 
  let node = tree;
  while (node.parent) {
    if (node.type === '-') {
      paths.pop()
    }
    paths.push(node.parent);
    node = node.parent;
  }
  paths.unshift(tree);
  paths.forEach(node => (node.children = []));
  paths.reverse();
  return paths;
}

function getCursorText(editor: Editor): string {
  const cursor = editor.getCursor();
  const lineText = editor.getLine(cursor.line);
  return lineText;
}

function parseLine(line: string) {
  const level = line.match(/^(\t*)/)[0].length;
  const branchId = getId();
  let content = line.replace(/^[\t]*-[\t]*/, '').trim();
  const isMark = /==.*?\[\[.*?#\^\w{6}(?:|.*?)\]\].*?==/.test(content);
  let type;
  if (/^\[.\](?!\])/.test(content)) {
    type = content[1];
    content = content.slice(3).trim();
  }

  const tag = content.match(/ #(\S+)/)?.[1];
  if (tag) content = content.replace(` #${tag}`, '');
  content = content.replace(/^\s*(?:.*?)(\[\[.*?\]\])\s*(?:.*?)(\^[0-9a-z]{6})?\s*$/, (match, p1, p2) => {
    p1 = isMark ? `==${p1}==` : p1;
    return p2 ? `${p1} ${p2}` : p1;
  });

  const regex = /^(=*)\[\[([^|#]+(?:#[^|]*)?)(?:\|([^\]]+))?\]\]\1(?:\s*\^([^\s=]+))?$|^([^[\]]+)$/;
  const match = content.match(regex);
  if (!match) return { type, level, name: content, tag, branchId, rawContent: line };
  if (match[5]) return { type, level, name: match[5], tag, branchId, rawContent: line };
  const [, , link, name, id] = match;
  return {
    id,
    tag,
    type: type || 'link',
    level,
    link,
    name: name || link,
    branchId,
    rawContent: line
  };
}

async function createTempRelationGraph(title: string, content: string, gitChartData: any, part: any) {
  const tempViewType = String(Date.now());

  self.app.workspace.detachLeavesOfType(tempViewType);

  const leaf = self.app.workspace.getLeaf('tab');
  await leaf.setViewState({
    type: tempViewType,
    active: true
  });

  self.registerView(tempViewType, (leaf: WorkspaceLeaf) => new TempRelationView(leaf, title, content, gitChartData, part) as any);
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
  part: any;
  constructor(leaf: WorkspaceLeaf, title: string, content: string, gitChart: any, part: any) {
    super(leaf);
    this.title = title;
    this.content = content;
    this.gitChart = gitChart;
    this.part = part;
    this.hideBranchNames = this.hideBranchNames.concat(hideBranchNames);
    hideBranchNames = [];
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
    const parentEl = container.createDiv('temp-relation-content');
    parentEl.style.width = '100%';
    parentEl.style.height = '100%';
    const contentEl = parentEl.createDiv('temp-relation-content-contarner');
    contentEl.addEventListener('click', this.onclick.bind(this));
    contentEl.addEventListener('mouseover', this.onmouseover.bind(this));
    contentEl.addEventListener('mouseout', this.onmouseout.bind(this));
    this.viewEl = contentEl;
    await render(self.app, this.content, contentEl);
    this.zoom = new ZoomDrag(parentEl);
    this.format();
    this.multicolorLabel();
  }

  format() {
    let textWidth = 0;
    this.viewEl.querySelectorAll('.commit-label').forEach((label: SVGTextElement) => {
      const [name, link, id, type, tag, branchName, branchId, level, parent, children] = label.textContent.split(separator);
      label.dataset.name = name;
      label.dataset.link = link;
      label.dataset.id = id;
      label.dataset.type = type;
      label.dataset.tag = tag;
      label.dataset.branchName = branchName;
      label.dataset.branchId = branchId;
      label.dataset.level = level;
      label.dataset.parent = parent;
      label.dataset.children = children;
      const w1 = label.getBBox().width;
      textWidth = Math.max(textWidth, w1);
      label.textContent = name;
      let x = Number(label.getAttribute('x'));
      let y = Number(label.getAttribute('y'));
      const w2 = label.getBBox().width;
      label.setAttribute('x', `${x + w1 - w2}`);
      label.setAttribute('y', `${y + 4}`);
      x = Number(label.getAttribute('x'));
      y = Number(label.getAttribute('y'));
      const bg = label.previousSibling as HTMLElement;
      bg.style.opacity = '1';
      bg.style.fontWeight = 'bold';
      bg.style.width = `${w2 + 6}px`;
      bg.setAttribute('x', String(x - 3));
      bg.setAttribute('y', String(y - 11));
      bg.style.display = 'none';
      if (type === '-') {
        label.style.opacity = '0.5';
        label.style.fontStyle = 'italic';
      } else if (type === '*') {
        bg.style.display = 'block';
        if (self.settings.gitChartMultiColorLabel) {
          bg.style.fill = this.getColor(branchId);
          bg.style.opacity = '.2';
        }
      }
    });

    // 隐藏滚动条
    this.viewEl.style.overflow = 'visible';
    this.viewEl.parentElement.style.overflow = 'hidden';

    document.querySelectorAll('.mermaid').forEach((mermaid: HTMLElement) => {
      // 调整svg为固定宽度
      const svg = mermaid.firstChild as HTMLElement;
      svg.setAttribute('width', svg.style.maxWidth);
      // 图表距离左边 10%
      const fullWidth = mermaid.clientWidth;
      const tenPercentWidth = fullWidth * -0.1;
      const viewBoxWidth = Number(svg.getAttribute('viewBox')?.split(' ')[0]);
      svg.style.transformOrigin = '50% 50%';
      svg.style.transform = `translate(${viewBoxWidth - tenPercentWidth}px, 0px) `;
    });
  }

  async onClose() {
    this.splitLeaf?.detach();
    this.containerEl.children[1].empty();
    this.zoom.destroy();
  }

  async onclick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const { name, link, branchId } = target.dataset;
    if (target.hasClass('commit-label')) {
      if (e.ctrlKey) this.truncation(name, branchId);
      else if (e.altKey) this.logicalChain(name, branchId);
      else this.openLink(link);
    }
    if (target.hasClass('commit')) {
      const target = e.target as HTMLElement;
      const name = target.classList[target.classList.length - 2];
      const id = name.split(separator)[6];
      if (!name) return;
      this.exhibitionBranch(id);
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

  async openLink(link: string) {
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

  async exhibitionBranch(id: string) {
    this.hideBranchNames = this.hideBranchNames.includes(id) ? this.hideBranchNames.filter(n => n !== id) : [...this.hideBranchNames, id];
    updateTreeCollapseState(this.gitChart, this.hideBranchNames);
    const content = partition(this.part, this.title, false);
    this.viewEl.empty();
    await render(self.app, content, this.viewEl);
    this.format();
    this.multicolorLabel();
  }

  logicalChain(name: string, id: string ) {
    const copy = findTree(deepClone(this.gitChart), id, 'branchId');
    let tree = getFlattenedPath(copy);
    if (!tree) return;
    createTempRelationGraph(name, generateGitgraphFromList({ children: tree }, name), tree, this.part);
  }

  truncation(name: string, id: string ) {
    const copy = deepClone(this.gitChart);
    updateTreeCollapseState(copy, []);
    let tree = findTree(copy, id, 'branchId');
    if (!tree) return;
    createTempRelationGraph(name, generateGitgraphFromList({ children: [tree] }, name), tree, this.part);
  }

  getLink(nodes: any, name: string): string {
    return findTree(nodes, name)?.link;
  }

  multicolorLabel() {
    if (!self.settings.gitChartMultiColorLabel) return;
    const labels = document.querySelectorAll('.commit-label');
    labels.forEach((label: HTMLElement) => {
      const id = label.dataset.branchId;
      const color = this.getColor(id);
      if (color) label.style.fill = color;
    });
  }

  getColor(id: string) {
    const commit = document.querySelector(`circle[class*="${id}"]`);
    return getComputedStyle(commit)?.fill;
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
  element: HTMLElementWithZoomDragState;
  elementEventHandlers = new WeakMap<HTMLElement, EventHandlerEntry[]>();

  constructor(element: Element) {
    this.element = element as HTMLElementWithZoomDragState;
    this.initEvents();
  }

  initEvents(): void {
    const element = this.element;
    element.zoomDragState = {
      scale: 1,
      x: 0,
      y: 0,
      isDragging: false,
      startX: 0,
      startY: 0,
      lastTouchDistance: null
    };

    const eventHandlers: EventHandlerEntry[] = [];

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
    const element = this.element;
    const state = (element as HTMLElementWithZoomDragState).zoomDragState!;
    if (state.isDragging) {
      state.x = e.clientX - state.startX;
      state.y = e.clientY - state.startY;
      this.applyTransform(element);
    }
  };

  handleMouseUp = (): void => {
    this.element.zoomDragState!.isDragging = false;
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
    const state = this.element.zoomDragState!;
    state.isDragging = false;
    state.lastTouchDistance = null;
  }

  applyTransform(element: HTMLElement): void {
    const state = (element as HTMLElementWithZoomDragState).zoomDragState!;
    const target = element.firstChild as HTMLElement;
    target.style.transformOrigin = '50% 50%';
    target.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
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
    const element = this.element;
    const handlers = this.elementEventHandlers.get(element);
    if (handlers) {
      handlers.forEach(({ type, handler, options }) => {
        element.removeEventListener(type, handler, options);
      });
    }

    delete (element as HTMLElementWithZoomDragState).zoomDragState;

    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }
}

function getId() {
  return Math.random().toString(36).slice(2);
}

function deepClone<T>(obj: T, map = new WeakMap()): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (map.has(obj)) {
    return map.get(obj);
  }

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

  const clone: any = Array.isArray(obj) ? [] : {};
  map.set(obj, clone);

  Reflect.ownKeys(obj).forEach(key => {
    clone[key] = deepClone((obj as any)[key], map);
  });

  return clone;
}
