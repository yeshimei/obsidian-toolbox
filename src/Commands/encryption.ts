import imageCompression from 'browser-image-compression';
import { md5 } from 'js-md5';
import { arrayBufferToBase64, base64ToArrayBuffer, Notice, TFile } from 'obsidian';
import Confirm from 'src/Modals/Confirm';
import InputBox from 'src/Modals/InputBox';
import { $, createFile, getBasename, insertString, isImagePath, isLongScreenshot, isNoteEncrypt, isResourceEncrypt, isVideoPath, mergeArrayBuffers } from '../helpers';
import Toolbox from '../main';
import ProgressBarEncryption from '../Modals/ProgressBarEncryption';
const progress = new ProgressBarEncryption();

export function encryptPopUpCommand(self: Toolbox) {
  self.settings.encryption &&
    self.addCommand({
      id: '加密笔记',
      name: '加密笔记',
      icon: 'lock',
      editorCallback: (editor, view) => encryptPopUp(self, view.file)
    });
}

export function decryptPopUpCommand(self: Toolbox) {
  self.settings.encryption &&
    self.addCommand({
      id: '解密笔记',
      name: '解密笔记',
      icon: 'lock-open',
      editorCallback: (editor, view) => decryptPopUp(self, view.file)
    });
}

export async function encOrDecPopUp(self: Toolbox, file: TFile) {
  if (!file) return;
  const type = self.settings.encryptionRememberPassMode;
  const tempPass = self.encryptionTempData[file.path];
  const encrypted = isNoteEncrypt(await self.app.vault.cachedRead(file));
  let { pass } = self.settings.plugins.encryption[file.path] || {};
  if (file.extension === 'md' && encrypted && (type === 'notSave' || (type === 'always' && !pass) || (type === 'disposable' && !tempPass))) {
    await decryptPopUp(self, file);
  }

  if ((type === 'always' && pass) || (type === 'disposable' && (pass = tempPass))) {
    new Confirm(self.app, {
      title: encrypted ? '解密这篇笔记？' : '加密这篇笔记？',
      onSubmit: res => res && encryptionNote(self, file, pass, !encrypted)
    }).open();
  }
}

export async function toggleEncryptNote(self: Toolbox, file: TFile) {
  if (!file) return;
  const content = await self.app.vault.read(file);
  const editorViewLine = $('.markdown-source-view .cm-content');
  const previewViewLine = $('.markdown-preview-view p[dir="auto"]');

  if (isNoteEncrypt(content)) {
    editorViewLine?.hide();
    previewViewLine?.hide();
  } else {
    editorViewLine?.show();
    previewViewLine?.show();
  }
}

export function clearNotePass(self: Toolbox) {
  // 清空已经删除笔记的本地记录
  for (let key in self.settings.plugins.encryption) {
    if (!self.app.vault.getFileByPath(key)) delete self.settings.plugins.encryption[key];
    self.saveSettings();
  }
  // 非永久记住密码，都清空本地密码
  if (self.settings.encryptionRememberPassMode !== 'always') {
    for (let key in self.settings.plugins.encryption) {
      const data = self.settings.plugins.encryption[key];
      if (data) data.pass = '';
    }

    self.saveSettings();
  }
}

export async function encryptPopUp(self: Toolbox, file: TFile) {
  if (!self.settings.encryption) return;
  const onSubmit = (pass: string) => {
    new Confirm(self.app, {
      content: `请确认，加密密码为 ${pass} `,
      onSubmit: res =>
        res &&
        new Confirm(self.app, {
          content: `请最后一次确认，加密密码为 ${pass} `,
          onSubmit: async res2 => res2 && encryptionNote(self, file, await AES256Helper.encrypt(md5(pass), pass))
        }).open()
    }).open();
  };

  new InputBox(self.app, {
    title: '加密笔记',
    name: '密码',
    description: '注意，本功能还处于测试阶段，请做好备份，避免因意外情况导致数据损坏或丢失。将加密笔记中的文字，图片以及视频（默认不开启），加密后的资源文件覆盖源文件，也请做好备份',
    onSubmit
  }).open();
}

export async function decryptPopUp(self: Toolbox, file: TFile) {
  if (!self.settings.encryption) return;
  new InputBox(self.app, {
    title: '解密笔记',
    name: '密码',
    onSubmit: async pass => encryptionNote(self, file, await AES256Helper.encrypt(md5(pass), pass), false)
  }).open();
}

export async function encryptionNote(self: Toolbox, file: TFile, pass: string, convert = true) {
  if (!file || !self.settings.encryption || !pass) return;
  let content = await self.app.vault.read(file);
  if (!content) return;
  let decryptContent;
  // 如果笔记已加密，从插件数据获取图像路径，否则获取笔记中的图像路径
  const isN = isNoteEncrypt(content);
  if (convert) {
    const localP = self.settings.plugins.encryption[file.path]?.pass;
    const tP = self.encryptionTempData[file.path];
    if (self.settings.encryptionImageCompress && (localP || tP) && pass !== (localP || tP)) {
      return new Notice('请先关闭图片压缩，使用旧密码恢复原图，再修改新密码');
    }
    isN ? new Notice('笔记已加密') : (decryptContent = await encrypt(content, pass));
  } else {
    try {
      isN ? (decryptContent = await decrypt(content.slice(32 + 1), pass)) : new Notice('笔记已解密');
    } catch (e) {
      new Notice('密码可能有误');
    }
  }

  let links = isN ? self.settings.plugins.encryption[file.path]?.links || [] : Object.keys(self.app.metadataCache.resolvedLinks[file.path]);
  if (decryptContent) {
    const localLinks = await imageToBase64(self, links, pass, convert);
    await self.app.vault.modify(file, (convert ? md5(file.path) + '%' : '') + decryptContent);
    toggleEncryptNote(self, file);
    self.settings.plugins.encryption[file.path] = {
      pass: self.settings.encryptionRememberPassMode === 'always' ? pass : '',
      links: localLinks
    };
    if (self.settings.encryptionRememberPassMode !== 'always') {
      self.encryptionTempData[file.path] = pass;
    }
    await self.saveSettings();
  }
}

async function imageToBase64(self: Toolbox, links: string[], pass: string, convert = true) {
  let index = 0;
  const chunkSize = Math.max(self.settings.encryptionChunkSize, 1024 * 1024);
  links = links.filter(isImagePath).concat(links.filter(isVideoPath));
  progress.show();
  let isN = true;
  try {
    for (let link of links) {
      let file = self.app.vault.getFileByPath(link);
      const suffixFile = self.app.vault.getFileByPath(insertString(file.path, -file.extension.length - 1, '__backup__'));
      if (!self.settings.encryptionImageCompress && isImagePath(link) && suffixFile) {
        await self.app.vault.delete(file);
        await self.app.vault.rename(suffixFile, link);
        if (convert) continue;
        link = suffixFile.path;
        file = suffixFile;
      }

      let fileSize = file.stat.size;
      let data: ArrayBuffer;
      let offset = 0;
      index++;
      progressUpdate(0, index, links.length, link, '正在读取');
      let arrayBuffer = await self.app.vault.adapter.readBinary(file.path);
      if (convert) {
        if (self.settings.encryptionImageCompress && isImagePath(link) && !suffixFile) {
          const compressArrayBuffer = await fileToArrayBuffer(
            await imageCompression(arrayBufferToFile(arrayBuffer, link, `image/${file.extension}`), {
              maxSizeMB: self.settings.encryptionImageCompressMaxSize,
              maxWidthOrHeight: (await isLongScreenshot(arrayBuffer, self.settings.encryptionImageCompressLongScreenshotRatio)) ? undefined : 720,
              preserveExif: self.settings.encryptionImageCompressPreserveExif,
              initialQuality: 0.4,
              useWebWorker: true,
              maxIteration: 10,
              onProgress: n => progressUpdate(n, index, links.length, link, `正在压缩 / ${n}%`)
            })
          );

          const backupPath = insertString(file.path, -file.extension.length - 1, '__backup__');
          await self.app.vault.rename(file, backupPath);
          self.settings.encryptionImageCompress = false; //fix 循环生成 backup 图片
          progress.hide();
          await imageToBase64(self, [backupPath], pass, convert);
          progress.show();
          self.settings.encryptionImageCompress = true;
          await self.app.vault.adapter.writeBinary(link, compressArrayBuffer);
          arrayBuffer = compressArrayBuffer;
          file = self.app.vault.getFileByPath(link);
          fileSize = file.stat.size;
        }
        while (offset < fileSize) {
          progressUpdate(computedProgress(offset, fileSize), index, links.length, link, `正在加密 / ${computedProgress(offset, fileSize)}%`);
          const chunk = arrayBuffer.slice(offset, offset + chunkSize);
          const chunkString = new TextDecoder().decode(chunk);
          if (isResourceEncrypt(chunkString)) {
            isN = false;
            new Notice(`${file.basename} 已加密`);
            break;
          }
          const base64Chunk = arrayBufferToBase64(chunk);
          const encryptedChunk = await encrypt(base64Chunk, pass);
          const chunkLength = encryptedChunk.length.toString().padStart(8, '0');
          const encryptedArrayBuffer = new TextEncoder().encode(chunkLength + encryptedChunk);
          data = data ? mergeArrayBuffers(data, encryptedArrayBuffer) : encryptedArrayBuffer;
          offset += chunkSize;
        }
      } else {
        while (offset < fileSize) {
          progressUpdate(computedProgress(offset, fileSize), index, links.length, link, `正在解密 / ${computedProgress(offset, fileSize)}%`);
          const chunkLength = parseInt(new TextDecoder().decode(arrayBuffer.slice(offset, offset + 8)), 10);
          offset += 8;
          const encryptedChunk = new TextDecoder().decode(arrayBuffer.slice(offset, offset + chunkLength));
          if (!isResourceEncrypt(encryptedChunk)) {
            isN = false;
            new Notice(`${file.basename} 已解密`);
            break;
          }
          const decryptedChunk = await decrypt(encryptedChunk, pass);
          const decryptedArrayBuffer = base64ToArrayBuffer(decryptedChunk);
          data = data ? mergeArrayBuffers(data, decryptedArrayBuffer) : decryptedArrayBuffer;
          offset += chunkLength;
        }
      }
      if (isN) {
        progressUpdate(100, index, links.length, link, '正在写入');
        const tempFilePath = `${file.path}.tmp`;
        const tempFile = await createFile(self.app, tempFilePath, true);
        await self.app.vault.adapter.writeBinary(tempFilePath, data);
        if (tempFile) {
          await self.app.vault.delete(file);
          await self.app.vault.rename(tempFile, file.path);
        }
      }
    }
  } catch (e) {
    new Notice('警告：笔记中可能存在已损坏资源文件，也有可能被移动或删除，请排查');
  }
  progress.hide();
  return links;
}

function progressUpdate(n: number, index: number, linksLength: number, link: string, message: string) {
  progress.update(Math.min(n, 100), `[${index}/${linksLength}] ${getBasename(link)} - ${message}`);
}

function computedProgress(offset: number, fileSize: number) {
  return Math.min(Math.floor((offset / fileSize) * 100), 100);
}

export async function encrypt(text: string, pass: string): Promise<string> {
  if (!text || !pass) return;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, data);
  const buffer = new Uint8Array(encrypted);
  const ivHex = Array.from(iv)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const encryptedHex = Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return ivHex + ':' + encryptedHex;
}

export async function decrypt(encryptedText: string, pass: string): Promise<string> {
  if (!encryptedText || !pass) return;

  const [ivHex, encryptedHex] = encryptedText.split(':');
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, encrypted);
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

export class AES256Helper {
  private static async getKeyMaterial(password: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  }

  private static async getKey(keyMaterial: CryptoKey): Promise<CryptoKey> {
    const salt = new Uint8Array(16); // 固定盐值
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async encrypt(password: string, data: string): Promise<string> {
    const iv = new Uint8Array(12); // 固定IV
    const keyMaterial = await AES256Helper.getKeyMaterial(password);
    const key = await AES256Helper.getKey(keyMaterial);

    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      enc.encode(data)
    );

    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  }

  static async decrypt(password: string, encryptedData: string): Promise<string> {
    const iv = new Uint8Array(12); // 固定IV
    const data = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map(char => char.charCodeAt(0))
    );

    const keyMaterial = await AES256Helper.getKeyMaterial(password);
    const key = await AES256Helper.getKey(keyMaterial);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  }
}

function arrayBufferToFile(arrayBuffer: ArrayBuffer, filename: string, mimeType: string): File {
  const blob = new Blob([arrayBuffer], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = () => {
      reject(new Error('File reading failed'));
    };
    reader.readAsArrayBuffer(file);
  });
}
