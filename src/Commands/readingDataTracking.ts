import { TFile } from 'obsidian';
import { computerReadingProgress, msTo, SOURCE_VIEW_CLASS, today } from 'src/helpers';
import Toolbox from 'src/main';
import Confirm from 'src/Modals/Confirm';
const keys = ['readingProgress', 'readingTime', 'readingDate', 'completionDate', 'readingTimeFormat']
export default async function readingDataTracking(self: Toolbox, file: TFile) {
  if (!self.settings.readDataTracking || !self.hasReadingPage(file)) return;
  const el = document.querySelector(SOURCE_VIEW_CLASS);
  const frontmatter = self.app.metadataCache.getFileCache(file)?.frontmatter || {};
  let readingData = self.readingManager.load(file.path)
  if (!readingData || frontmatter?.readingTime > readingData?.readingTime) {
    readingData = frontmatter
  }
  readingData = allowlist(readingData, keys)
  let { readingProgress = 0, readingDate, completionDate } = readingData;
  if (readingDate && !completionDate) {
    // 阅读进度
    readingData.readingProgress = computerReadingProgress(el);
    // 阅读时长
    if (!readingData.readingTime) readingData.readingTime = 0;
    readingData.readingTime += Math.min(self.settings.readDataTrackingTimeout, Date.now() - self.startTime);
    self.startTime = Date.now();
    // 格式化的阅读时长
    readingData.readingTimeFormat = msTo(readingData.readingTime);
  }
  // 是否未读
  if (!readingDate) {
    new Confirm(self.app, {
      content: `《${file.basename}》未过读，是否标记在读？`,
      onSubmit: res => {
        if (res) {
          readingData.readingDate = today();
          self.readingManager.save(file.path, readingData);
        }
      }
    }).open();
  }
  // 是否读完
  if (readingProgress >= 100 && !completionDate) {
    new Confirm(self.app, {
      content: `《${file.basename}》进度 100%，是否标记读完？`,
      onSubmit: res => {
        if (res) {
          readingData.completionDate = today();
          self.readingManager.save(file.path, readingData);
        }
      }
    }).open();
  }

  await self.readingManager.save(file.path, readingData);

  if (self.settings.readDataTrackingSync) {
    await readingDataSync(self, file);
  }
}

export async function readingDataSync(self: Toolbox, file: TFile) {
  const readingData = allowlist(self.readingManager.load(file.path), keys)
  if (!readingData) return;
  for (let key in readingData) {
    await self.updateFrontmatter(file, key, readingData[key]);
  }
}

function allowlist<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return Object.keys(obj).reduce((acc, key) => {
    if (keys.includes(key as K)) {
      acc[key as K] = obj[key as K];
    }
    return acc;
  }, {} as Pick<T, K>);
}

export class ReadingDataManager {
  private dataPath: string;
  private data: any = {};

  constructor(private self: Toolbox) {
    this.dataPath = `${self.app.vault.configDir}/plugins/toolbox/readingData.json`;
    this.initialize();
  }

  async initialize() {
    await this.ensureDataFile();
    await this.loadData();
  }
  private async ensureDataFile() {
    const dirPath = this.dataPath.split('/').slice(0, -1).join('/');
    if (!(await this.self.app.vault.adapter.exists(dirPath))) {
      await this.self.app.vault.adapter.mkdir(dirPath);
    }

    if (!(await this.self.app.vault.adapter.exists(this.dataPath))) {
      this.data = {};
      await this.saveRawData();
    }
  }

  private async loadData() {
    try {
      const content = await this.self.app.vault.adapter.read(this.dataPath);
      this.data = JSON.parse(content || '{}');
    } catch (error) {
      console.error('Error loading reading data:', error);
      this.data = {};
    }
  }

  private async saveRawData() {
    await this.self.app.vault.adapter.write(this.dataPath, JSON.stringify(this.data, null, 2));
  }

  async save(filepath: string, data: any) {
    if (!data) return;
    this.data[filepath] = data;
    await this.saveRawData();
  }

  load(filepath: string) {
    return this.data[filepath];
  }

  getAllStats() {
    return this.data;
  }
}
