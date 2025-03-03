import { TFile } from 'obsidian';
import { computerReadingProgress, msTo, SOURCE_VIEW_CLASS, today } from 'src/helpers';
import Toolbox from 'src/main';
import Confirm from 'src/Modals/Confirm';

export default function readingDataTracking(self: Toolbox, file: TFile) {
  if (!self.settings.readDataTracking || !self.hasReadingPage(file)) return;
  const el = document.querySelector(SOURCE_VIEW_CLASS);
  let { readingProgress = 0, readingDate, completionDate } = self.app.metadataCache.getFileCache(file)?.frontmatter || {};
  self.app.fileManager.processFrontMatter(file, frontmatter => {
    if (readingDate && !completionDate) {
      // 阅读进度
      frontmatter.readingProgress = computerReadingProgress(el);
      // 阅读时长
      if (!frontmatter.readingTime) frontmatter.readingTime = 0;
      frontmatter.readingTime += Math.min(self.settings.readDataTrackingTimeout, Date.now() - self.startTime);
      self.startTime = Date.now();
      // 格式化的阅读时长
      frontmatter.readingTimeFormat = msTo(frontmatter.readingTime);
    }
    // 是否未读
    if (!readingDate) {
      new Confirm(self.app, {
        content: `《${file.basename}》未过读，是否标记在读？`,
        onSubmit: res => res && self.updateFrontmatter(file, 'readingDate', today())
      }).open();
    }
    // 是否读完
    if (readingProgress >= 100 && !completionDate) {
      new Confirm(self.app, {
        content: `《${file.basename}》进度 100%，是否标记读完？`,
        onSubmit: res => res && self.updateFrontmatter(file, 'completionDate', today())
      }).open();
    }
  });
}
