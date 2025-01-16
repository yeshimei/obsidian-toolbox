import { htmlToMarkdown, Notice, request } from 'obsidian';
import { requestUrlToHTML } from 'src/helpers';
import Toolbox from 'src/main';
import { PanelSearchForPlants } from 'src/Modals/PanelSearchForPlants';

export default function searchForPlantCommand(self: Toolbox) {
  self.settings.searchForPlants &&
    self.addCommand({
      id: '查植物',
      name: '查植物',
      icon: 'flower-2',
      callback: () => searchForPlant(self)
    });
}

async function searchForPlant(self: Toolbox) {
  if (!self.settings.searchForPlants) return;
  new PanelSearchForPlants(self.app, async (name: string) => {
    const html = await requestUrlToHTML('https://www.iplant.cn/info/' + name);
    const id = html.querySelector('.barcodeimg img').getAttr('src').split('=').pop();
    const latinName = html.querySelector('#sptitlel')?.textContent;
    let alias = html.querySelector('.infomore>div')?.firstChild?.textContent;
    let other = html.querySelector('.infomore>.spantxt')?.textContent;

    if (latinName.trim() === '' && other) {
      new Notice(`${name}？您是否在找 ${other}`);
      return;
    }

    if (id === '') {
      new Notice(`${name}？您可能输入错误或植物智不存在相关植物`);
      return;
    }

    if (alias.indexOf('俗名') > -1) {
      alias = alias.split('、').join('\n - ').replace('俗名：', '\n - ');
    } else {
      alias = ' ';
    }

    const classsys = extractChineseParts(JSON.parse(await request(`https://www.iplant.cn/ashx/getspinfos.ashx?spid=${id}&type=classsys`)).classsys.find((text: string) => Object.keys(plantClassificationSystem).some(name => text.indexOf(name) > -1)));

    const plantIntelligence = await request(`https://www.iplant.cn/ashx/getfrps.ashx?key=${latinName.split(' ').join('+')}`);
    const lifestyleForm = plantIntelligence ? htmlToMarkdown(JSON.parse(plantIntelligence).frpsdesc).replace(/^[^\n]*\n[^\n]*\n[^\n]*\n/, '') : '《植物智》未收录。';

    const content = `---\n中文名: ${name}\n拉丁学名: ${latinName}\n别名: ${alias}\n${classsys}\n识别特征: \n---\n${lifestyleForm}`;

    const filepath = '卡片盒/归档/' + name + '.md';
    let file = self.app.vault.getFileByPath(filepath) || self.app.vault.getFileByPath('卡片盒/' + name + '.md');
    if (file) {
      new Notice('查询的植物笔记已存在');
    } else {
      file = await self.app.vault.create(filepath, content);
    }
    self.app.workspace.getLeaf(true).openFile(file);
  }).open();
}

const plantClassificationSystem: any = {
  被子植物分类系统: `界: 植物界 \n门: 被子植物门`,
  裸子植物分类系统: `界: 植物界 \n门: 裸子植物门`,
  石松类和蕨类植物分类系统: `界: 植物界 \n门: 蕨类植物门`,
  苔藓植物分类系统: `界: 植物界 \n门: 苔藓植物门`
};

export function extractChineseParts(inputString: string) {
  const chineseParts = inputString.match(/[\u4e00-\u9fa5]+/g).reverse();
  const yamlObject: any = {};
  const sy = chineseParts.shift();
  const keys = ['亚门', '纲', '亚纲', '超目', '科', '属'];
  for (let i = 0; i < keys.length; i++) {
    yamlObject[keys[i]] = chineseParts.find(text => text.indexOf(keys[i]) > -1) || '';
  }
  yamlObject['目'] = chineseParts.find(text => text.slice(-1) === '目' && text.slice(-2) !== '超目') || '';
  return `${plantClassificationSystem[sy]}
亚门: ${yamlObject['亚门']}
纲: ${yamlObject['纲']}
亚纲: ${yamlObject['亚纲']}
超目: ${yamlObject['超目']}
科: ${yamlObject['科']}
目: ${yamlObject['目']}
属: ${yamlObject['属']}`;
}
