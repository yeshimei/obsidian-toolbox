import imageCompression from 'browser-image-compression';
import { arrayBufferToBase64, base64ToArrayBuffer, Notice } from 'obsidian';
import { createFile, getBasename, insertString, isImagePath, isLongScreenshot, isResourceEncrypt, isVideoPath, mergeArrayBuffers } from './helpers';
import ProgressBarEncryption from './Modals/ProgressBarEncryption';
import Toolbox from './main';
const progress = new ProgressBarEncryption();

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

export async function imageToBase64(self: Toolbox, links: string[], pass: string, convert = true) {
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
