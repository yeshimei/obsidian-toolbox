import { arrayBufferToBase64, base64ToArrayBuffer, TFile } from 'obsidian';
import { insertString, isBase64, isNoteEncrypt, isResourceEncrypt } from 'src/helpers';
import Toolbox from 'src/main';
import { clearRootFFolder, create, readBinaryToBase64, readBinaryToString } from 'test';
import test from 'test/Test';
const root = 'test';
const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAwAB/6Gf8AAAAABJRU5ErkJggg==';

test.afterEach(async self => {
  await clearRootFFolder(self);
});

test.add('Encryption', '纯文本笔记', async (self: Toolbox) => {
  const content = '我是一条段落';
  const pass = '123';
  self.settings.encryption = true;
  self.settings.encryptionSupportVideo = false;
  self.settings.encryptionImageCompress = false;
  self.settings.encryptionSupportImage = false;
  self.saveSettings();

  const file = await create(self, '123', content);
  await self.encryptionNote(file, pass, true);
  const encryptContent = await self.app.vault.read(file);
  test.assertTrue(isNoteEncrypt(encryptContent));

  await self.encryptionNote(file, '123', false);
  const decryptContent = await self.app.vault.read(file);
  test.assertEqual(decryptContent, content);
});

test.add('Encryption', '图片笔记', async (self: Toolbox) => {
  const jpg = root + '/1.jpg';
  const arrayBuffer = base64ToArrayBuffer(base64Image);
  await self.app.vault.adapter.writeBinary(jpg, arrayBuffer);

  const content = '我是一条段落 [[1.jpg]]';
  const pass = '123';
  self.settings.encryption = true;
  self.settings.encryptionSupportImage = true;
  self.settings.encryptionImageCompress = false;
  self.settings.encryptionSupportVideo = false;
  self.saveSettings();

  const file = await create(self, '123', content);
  await self.encryptionNote(file, pass, true);

  const encryptContent = await self.app.vault.read(file);
  const encryptJpg = await readBinaryToString(self, jpg);

  test.assertTrue(isNoteEncrypt(encryptContent), '1 笔记已加密');
  test.assertTrue(isResourceEncrypt(encryptJpg), '2 图片已加密');
  await self.encryptionNote(file, pass, false);
  const decryptContent = await self.app.vault.read(file);
  test.assertEqual(decryptContent, content, '3 解密后，笔记与加密前相同');
  const decryptJpg = await readBinaryToBase64(self, jpg);
  test.assertEqual(decryptJpg, base64Image, '4 解密后，图片与加密前相同');
});

test.add('Encryption', '开启图片压缩', async (self: Toolbox) => {
  const jpg = root + '/1.jpg';
  const arrayBuffer = base64ToArrayBuffer(base64Image);
  await self.app.vault.adapter.writeBinary(jpg, arrayBuffer);

  const content = '我是一条段落 [[1.jpg]]';
  const pass = '123';
  self.settings.encryption = true;
  self.settings.encryptionSupportImage = true;
  self.settings.encryptionImageCompress = true;
  self.settings.encryptionSupportVideo = false;
  self.saveSettings();

  const f1 = await create(self, '123', content);
  await self.encryptionNote(f1, pass, true);

  const jpgFile = self.app.vault.getFileByPath(jpg);
  const backupJpg = insertString(jpgFile.path, -jpgFile.extension.length - 1, '__backup__');
  const f2 = self.app.vault.getFileByPath(backupJpg);

  // 开启图片压缩选项
  test.assertTrue(f2.name.indexOf('__backup__'), '1 加密笔记后，压缩图替换原图，原图添加后缀 __backup__');
  const decryptJpg1 = await readBinaryToBase64(self, backupJpg);
  await self.encryptionNote(f1, pass, false);

  // 关闭图片压缩选项
  self.settings.encryptionImageCompress = false;
  await self.encryptionNote(f1, pass, true);
  const f3 = self.app.vault.getFileByPath(backupJpg);
  const decryptJpg2 = await readBinaryToBase64(self, jpg);
  test.assertFalse(f3, '2 删除压缩图');
  test.assertEqual(decryptJpg1, decryptJpg2, '3 换回原图');

  // 在笔记加密时关闭图片压缩选项与上个相同
  await self.encryptionNote(f1, pass, false);
  self.settings.encryptionImageCompress = true;
  await self.encryptionNote(f1, pass, true);
  self.settings.encryptionImageCompress = false;
  await self.encryptionNote(f1, pass, false);
  const f4 = self.app.vault.getFileByPath(backupJpg);
  const decryptJpg4 = await readBinaryToBase64(self, jpg);
  test.assertFalse(f4, '4 删除压缩图');
  test.assertEqual(decryptJpg4, base64Image, '5 换回原图');

  // 在开启图片压缩选项时修改密码
  // 会提醒，请先关闭图片压缩，使用旧密码恢复原图，再修改新密码
  self.settings.encryptionImageCompress = true;
  self.settings.encryptionRememberPassMode = 'always';
  await self.encryptionNote(f1, pass, true);
  await self.encryptionNote(f1, pass, false);
  const decryptJpg5 = await readBinaryToBase64(self, jpg);
  const c1 = await self.app.vault.read(f1);
  const p1 = self.settings.plugins.encryption[f1.path].pass;
  await self.encryptionNote(f1, pass + '1', true);
  const c2 = await self.app.vault.read(f1);
  const decryptJpg6 = await readBinaryToBase64(self, jpg);
  const p2 = self.settings.plugins.encryption[f1.path].pass;
  test.assertEqual(decryptJpg5, decryptJpg6, '6 图片不加密');
  test.assertEqual(c1, c2, '7 笔记不加密');
  test.assertEqual(p1, p2, '8 本地不记录密码');

  // 关闭图片压缩选项后修改密码，则成功
  self.settings.encryptionImageCompress = false;
  await self.encryptionNote(f1, pass + '1', true);
  await self.encryptionNote(f1, pass + '1', false);
  const p3 = self.settings.plugins.encryption[f1.path].pass;
  test.assertNotEqual(p3, p2);
});

test.add('Encryption', '图片笔记', async (self: Toolbox) => {
  const arrayBuffer = base64ToArrayBuffer(base64Image);
  const jpg = root + '/1.jpg';
  await self.app.vault.adapter.writeBinary(jpg, arrayBuffer);

  const content = '我是一条段落 [[1.jpg]]';
  const pass = '123';
  self.settings.encryption = true;
  self.settings.encryptionSupportImage = true;
  self.settings.encryptionImageCompress = false;
  self.settings.encryptionSupportVideo = false;
  self.saveSettings();

  const file = await create(self, '123', content);
  await self.encryptionNote(file, pass, true);

  const encryptContent = await self.app.vault.read(file);
  const encryptJpg = await readBinaryToBase64(self, jpg);
  test.assertTrue(isNoteEncrypt(encryptContent));
  test.assertTrue(/^[a-zA-z0-9]+$/.test(encryptJpg));
  await self.encryptionNote(file, pass, false);

  const decryptContent = await self.app.vault.read(file);
  test.assertEqual(decryptContent, content);

  const decryptJpg = await readBinaryToBase64(self, jpg);
  test.assertEqual(decryptJpg, base64Image);
});

test.add('Encryption', '相同一张图片不会重复加密', async (self: Toolbox) => {
  const arrayBuffer = base64ToArrayBuffer(base64Image);
  const jpg = root + '/1.jpg';
  await self.app.vault.adapter.writeBinary(jpg, arrayBuffer);

  const content = '我是一条段落 [[1.jpg]]';
  const content2 = '我是一条重复的段落 [[1.jpg]]';
  const pass = '123';
  self.settings.encryption = true;
  self.settings.encryptionSupportImage = true;
  self.settings.encryptionImageCompress = false;
  self.settings.encryptionSupportVideo = false;
  self.saveSettings();

  const f1 = await create(self, '123', content);
  const f2 = await create(self, '1234', content2);
  await self.encryptionNote(f1, pass, true);
  const e1 = await readBinaryToBase64(self, jpg);
  await self.encryptionNote(f2, pass, true);
  const e2 = await readBinaryToBase64(self, jpg);
  test.assertEqual(e1, e2);
});
