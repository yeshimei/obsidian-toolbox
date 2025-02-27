import { App, Editor, ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import { render } from 'src/helpers';
import Toolbox from 'src/main';

export default function relationshipDiagramCommand(self: Toolbox) {
  self.settings.highlight &&
    self.addCommand({
      id: '打开关系图',
      name: '打开关系图',
      icon: 'git-compare-arrows',
      editorCallback: (editor, view) => relationshipDiagram(self, editor, view.file)
    });
}

async function relationshipDiagram(self: Toolbox, editor: Editor, file: TFile) {
  const content = await self.app.vault.read(file);
  const filename = file.basename;
  const lineText = getCursorText(editor);
  const { name } = parseLine(lineText);
  const text = await generateGitgraphFromList(self, filename, content, name);
  createTempRelationGraph(self, name || filename, text);
}

async function generateGitgraphFromList(self: Toolbox, filename: string, listStr: string, name?: string) {
  let root = parseListToTree(listStr);
  root = {
    children: [
      {
        name: filename,
        branchName: filename,
        children: root.children
      }
    ]
  };

  root = name ? { children: [filterRoot(root.children, name)] } : root;



  async function a (node: any) {
    for (let child of node.children) {
      if(child.type === '==') {
          const [filename, id] = child.link.split('#^')
          const file = self.getFileByShort(filename)
          if (file) {
            const content = await self.app.vault.read(file);
            const r = parseListToTree(content)
            const d = filterRoot(r.children, id, 'id')
            if (d) {
               child.children = d.children
            }
          }
      }
  
      if (child.children.length > 0) {
        await a(child)
      }
    }
  }


  await a(root)

  
  const commands = [
    `\`\`\`mermaid
---
title: ${root.children[0].name}
---
%%%{init: {'gitGraph': {'rotateCommitLabel': false}} }%%%
gitGraph TB:`
  ];

  for (const mainNode of root.children) {
    if (mainNode.children.length > 0) {
      processBranch(mainNode, commands);
    }
  }
  return commands.slice(0, -1).join('\n') + '\n```';
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

function parseListToTree(str: string) {
  const lines = str.split('\n').filter(l => l.trim());
  const root: any = { children: [] };
  const stack = [{ node: root, level: -1 }];
  for (const line of lines) {
    let { level, name, type, link, id } = parseLine(line);
    if (!name) continue
    
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;
    const newNode: any = { id, name, level, type, link, children: [], branchName: parent?.name || '默认', parent};
    parent.children.push(newNode);
    stack.push({ node: newNode, level });
  }
  return root;
}

function filterRoot(originalRoot: any, targetName: string, key = 'name') {
  for (const child of originalRoot) {
    if (child[key] === targetName) {
      return child;
    }
    if (child.children.length > 0) {
      const found: any = filterRoot(child.children, targetName, key);
      if (found) return found;
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
  const content = line.replace(/^[\t]*-[\t]*/, '').trim();
  const regex = /^(=*)\[\[([^|#]+(?:#[^|]*)?)(?:\|([^\]]+))?\]\]\1(?:\s*\^([^\s=]+))?$|^([^[\]]+)$/
  const match = content.match(regex);
  if (!match) return {type: 'plain', level, name: content};
  if (match[5]) return {type: 'plain', level, name: match[5]};
  const [ , type, link, name, id ] = match;
  return {
    id,
    type: type || 'link', 
    level,
    link,
    name: name || link,
  };
}

async function createTempRelationGraph(self: Toolbox, title: string, content: string) {
  const tempViewType = String(Date.now());

  self.app.workspace.detachLeavesOfType(tempViewType);

  const leaf = self.app.workspace.getLeaf('tab');
  await leaf.setViewState({
    type: tempViewType,
    active: true
  });

  self.registerView(tempViewType, (leaf: WorkspaceLeaf) => new TempRelationView(leaf, self.app, title, content) as any);

  self.app.workspace.revealLeaf(leaf);
}

class TempRelationView extends ItemView {
  private title: string;
  private content: string;
  private zoom: ZoomDrag
  constructor(leaf: WorkspaceLeaf, app: App, title: string, content: string) {
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
    contentEl.style.overflow = 'hidden'
    await render(this.app, this.content, contentEl);
    this.zoom = new ZoomDrag('.mermaid')
  }

  async onClose() {
    this.containerEl.children[1].empty();
    this.zoom.destroy()
  }
}


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
  private elements: NodeListOf<HTMLElement>;
  private elementEventHandlers = new WeakMap<HTMLElement, EventHandlerEntry[]>();

  constructor(className: string) {
      this.elements = document.querySelectorAll<HTMLElement>(className);
      this.initEvents();
  }

  private initEvents(): void {
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

  private handleWheel(e: WheelEvent): void {
      e.preventDefault();
      const element = e.currentTarget as HTMLElementWithZoomDragState;
      const state = element.zoomDragState!;
      const rect = element.getBoundingClientRect();
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = state.scale * delta;
      
      if (newScale < 0.1 || newScale > 5) return;
      
      state.x = mouseX - (mouseX - state.x) * delta;
      state.y = mouseY - (mouseY - state.y) * delta;
      state.scale = newScale;
      
      this.applyTransform(element);
  }

  private handleMouseDown(e: MouseEvent): void {
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

  private handleMouseMove = (e: MouseEvent): void => {
      this.elements.forEach(element => {
          const state = (element as HTMLElementWithZoomDragState).zoomDragState!;
          if (state.isDragging) {
              state.x = e.clientX - state.startX;
              state.y = e.clientY - state.startY;
              this.applyTransform(element);
          }
      });
  }

  private handleMouseUp = (): void => {
      this.elements.forEach(element => {
          (element as HTMLElementWithZoomDragState).zoomDragState!.isDragging = false;
      });
      document.removeEventListener('mousemove', this.handleMouseMove);
      document.removeEventListener('mouseup', this.handleMouseUp);
  }

  private handleTouchStart(e: TouchEvent): void {
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

  private handleTouchMove(e: TouchEvent): void {
      e.preventDefault();
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

  private handleTouchEnd(): void {
      this.elements.forEach(element => {
          const state = (element as HTMLElementWithZoomDragState).zoomDragState!;
          state.isDragging = false;
          state.lastTouchDistance = null;
      });
  }

  private applyTransform(element: HTMLElement): void {
      const state = (element as HTMLElementWithZoomDragState).zoomDragState!;
      element.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
      element.style.transformOrigin = '50% 50%'
  }

  private getTouchDistance(touches: TouchList): number {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
  }

  private getTouchCenter(touches: TouchList): { x: number; y: number } {
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