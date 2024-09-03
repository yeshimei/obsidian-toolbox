import { AES256Helper, encrypt, decrypt } from 'src/Encryption';
import Toolbox from 'src/main';
import { clearRootFFolder, create, remove } from 'test';
import test from './Test';

const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAwAB/6Gf8AAAAABJRU5ErkJggg==';

test.afterEach(async self => {
  await clearRootFFolder(self);
});

test.add('AES256Helper', '加密的密码相同', async () => {
  const pass = '123';
  const p1 = await AES256Helper.encrypt(pass, pass);
  const p2 = await AES256Helper.encrypt(pass, pass);
  test.assertEqual(p1, p2);
});

test.add('encrypt,decrypt', '加密和解密后的文本相同', async () => {
  const pass = '123';
  const content = '这是一个段落';
  const p1 = await encrypt(content, pass);
  const p2 = await decrypt(p1, pass);
  test.assertEqual(p2, content);
});

test.add('encrypt,decrypt', '加密和解密后的base64相同', async () => {
  const pass = '123';
  const p1 = await encrypt(base64Image, pass);
  const p2 = await decrypt(p1, pass);
  test.assertEqual(p2, base64Image);
});
