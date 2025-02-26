import { App, Editor, ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import { render } from 'src/helpers';
import Toolbox from 'src/main';

export default function relationshipDiagramCommand(self: Toolbox) {
  self.settings.highlight &&
    self.addCommand({
      id: '打开关系图',
      name: '打开关系图',
      icon: 'brush',
      editorCallback: (editor, view) => relationshipDiagram(self, editor, view.file)
    });
}

async function relationshipDiagram(self: Toolbox, editor: Editor, file: TFile) {
  const content = await self.app.vault.read(file);
  const filename = file.basename;
  const lineText = getCursorText(editor);
  const { name } = parseLine(lineText);
  const text = generateGitgraphFromList(filename, content, name);
  createTempRelationGraph(self, name || filename, text);
}

function generateGitgraphFromList(filename: string, listStr: string, name?: string) {
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

  root = name ? { children: [filterRootByName(root.children, name)] } : root;
  const commands = [
    `\`\`\`mermaid
---
title: ${root.children[0].name}
---
%%%{init: {'gitGraph': {'rotateCommitLabel': false}} }%%%
gitGraph TB:`
  ];

  for (const mainNode of root.children) {
    console.log(mainNode);
    if (mainNode.children.length > 0) {
      processBranch(mainNode, commands);
    }
  }
  return commands.slice(0, -1).join('\n') + '\n```';

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
      const { level, name } = parseLine(line);
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      const parent = stack[stack.length - 1].node;
      const newNode: any = { name, children: [], branchName: parent?.name || filename };
      parent.children.push(newNode);
      stack.push({ node: newNode, level });
    }
    return root;
  }
}

function filterRootByName(originalRoot: any, targetName: string) {
  for (const child of originalRoot) {
    if (child.name === targetName) {
      return child;
    }
    if (child.children.length > 0) {
      const found: any = filterRootByName(child.children, targetName);
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
  const content = line.replace(/^[\t]*-[\t]*/, '');
  const linkMatch = content.match(/\[\[(.*?)(\|(.*?))?\]\]/);

  return {
    level,
    name: linkMatch ? linkMatch[3] || linkMatch[1].split('/').pop().split('#')[0] : content.trim()
  };
}

async function createTempRelationGraph(self: Toolbox, title: string, content: string) {
  const tempViewType = title;

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
    render(this.app, this.content, contentEl);
  }

  async onClose() {
    this.containerEl.children[1].empty();
  }
}
