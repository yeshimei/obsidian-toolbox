import { Notice } from 'obsidian';
import { isNoteEncrypt } from './helpers';

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

  private static async getKey(keyMaterial: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
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
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyMaterial = await AES256Helper.getKeyMaterial(password);
    const key = await AES256Helper.getKey(keyMaterial, salt);

    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      enc.encode(data)
    );

    const encryptedArray = new Uint8Array(encrypted);
    const combinedArray = new Uint8Array(salt.length + iv.length + encryptedArray.length);
    combinedArray.set(salt);
    combinedArray.set(iv, salt.length);
    combinedArray.set(encryptedArray, salt.length + iv.length);

    return btoa(String.fromCharCode(...combinedArray));
  }

  static async decrypt(password: string, encryptedData: string): Promise<string> {
    const combinedArray = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map(char => char.charCodeAt(0))
    );
    const salt = combinedArray.slice(0, 16);
    const iv = combinedArray.slice(16, 28);
    const data = combinedArray.slice(28);

    const keyMaterial = await AES256Helper.getKeyMaterial(password);
    const key = await AES256Helper.getKey(keyMaterial, salt);

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
