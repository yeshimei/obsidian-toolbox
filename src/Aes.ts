import { Notice } from 'obsidian';
import { md5 } from 'js-md5';
import { isNoteEncrypt } from './helpers';

export async function encrypt(text: string, pass: string): Promise<string> {
  if (isNoteEncrypt(text)) {
    new Notice('笔记已加密');
    return;
  }

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
  return md5(pass) + '%' + ivHex + ':' + encryptedHex;
}

export async function decrypt(encryptedText: string, pass: string): Promise<string> {
  if (isNoteEncrypt(encryptedText)) {
    if (encryptedText.slice(0, 32) === md5(pass)) {
      encryptedText = encryptedText.slice(32 + 1); /** md5 长度加上一个分隔符 */
    } else {
      new Notice('密码错误');
      return;
    }
  } else {
    new Notice('笔记已解密');
    return;
  }
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

export function arrayBufferToBase64(buffer: any) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function convertBase64ToImage(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
