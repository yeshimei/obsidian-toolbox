import { renumberFootnote } from 'src/Commands/renumberFootnote';
import Toolbox from 'src/main';
import { clearRootFFolder, create } from 'test';
import test from 'test/Test';

test.afterEach(async self => {
  await clearRootFFolder(self);
});

test.add('脚注重编号', '', async (self: Toolbox) => {
  const file = await create(self, '1', 'a[^1]\n[^1]: 123\na[^2]\n[^2]: 456\na[^1]\n[^1]: 789');
  renumberFootnote(self, file);
  const content = await self.app.vault.read(file);
  test.assertEqual(content, 'a[^1][^1]: 123\na[^2][^2]: 456\na[^3][^3]: 789');
});
