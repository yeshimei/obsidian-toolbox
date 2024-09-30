import { Editor } from 'obsidian';
import Toolbox from 'src/main';

export default async function clipboardFormatCommand(self: Toolbox) {
  self.settings.cleanClipboardContent &&
    self.addCommand({
      id: '剪切板文本格式化',
      name: '剪切板文本格式化',
      icon: 'clipboard-check',
      editorCallback: async editor => clipboardFormat(self, editor)
    });
}

/**
 * 处理剪贴板内容并进行格式化。
 * @param self - Toolbox 实例
 * @param editor - 编辑器实例
 */
async function clipboardFormat(self: Toolbox, editor: Editor) {
  if (!editor || !self.settings.cleanClipboardContent) return;
  const text = await navigator.clipboard.readText();
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/(\w)\s+(\w)/g, '$1 $2')
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2')
    .replace(/([\u4e00-\u9fa5])(\w)/g, '$1 $2')
    .replace(/(\w)([\u4e00-\u9fa5])/g, '$1 $2')
    .trim();

  editor.replaceRange(cleaned, editor.getCursor());
}
