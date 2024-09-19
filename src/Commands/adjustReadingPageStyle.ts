import { TFile } from 'obsidian';
import Toolbox from 'src/main';

export default function adjustReadingPageStyle(self: Toolbox, el: HTMLElement, file: TFile) {
  if (self.settings.readingPageStyles && self.hasReadingPage(file)) {
    el.style.fontSize = self.settings.fontSize + 'px';
  } else {
    el.style.fontSize = 'unset';
  }
}
