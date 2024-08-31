import { App, Notice, TFile } from 'obsidian';
import { unique } from './helpers';

export async function encrypt(text: string, password: string): Promise<string> {
  if (!text || !password) return;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
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

export async function decrypt(encryptedText: string, password: string): Promise<string> {
  if (!encryptedText || !password) return;
  try {
    const [ivHex, encryptedHex] = encryptedText.split(':');
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
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
  } catch (e) {
    new Notice('解密失败，可能密码有误或加密数据被篡改。');
  }
}

export async function imageToBase64(app: App, file: TFile, action: 'convert' | 'restore', pass: string) {
  const content = await app.vault.read(file);
  if (!content) return;
  const imageRegex = /\[\[(.*?\.(png|jpg|jpeg|gif|bmp|svg))\]\]/g;
  let links = content.match(imageRegex) as string[];
  if (links) {
    links = unique(links).map(text => text.slice(2, -2));
    for (let link of links) {
      const file = app.metadataCache.getFirstLinkpathDest(link, '');
      if (action === 'convert') {
        const arrayBuffer = await app.vault.adapter.readBinary(file.path);
        const base64 = arrayBufferToBase64(arrayBuffer);
        app.vault.modify(file, await encrypt(base64, pass));
      } else if (action === 'restore') {
        const base64 = await app.vault.read(file);
        if (base64) {
          const bytes = convertBase64ToImage(await decrypt(base64, pass));
          await app.vault.adapter.writeBinary(file.path, bytes);
        }
      }
    }
  }
}

function arrayBufferToBase64(buffer: any) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function convertBase64ToImage(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
