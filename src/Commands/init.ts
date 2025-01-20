import { Platform } from 'obsidian';
import Toolbox from 'src/main';

export default function init(self: Toolbox) {
  if (!Platform.isMobile) {
    Object.assign(self.settings, {
      // flip: false,
      // fullScreenMode: false,
      // readDataTracking: false,
      // searchForWords: false,
      // highlight: false,
      // readingNotes: false,
      // readingPageStyles: false,
      // poster: false,
      // dialogue: false,
      // characterRelationships: false
    });
    self.saveSettings();
  }
}
