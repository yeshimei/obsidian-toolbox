import { Platform } from 'obsidian';
import Toolbox from 'src/main';

export default function poster(self: Toolbox, element: HTMLElement) {
  if (!self.settings.poster || !Platform.isMobile) return;
  const processVideos = (element: HTMLElement) => {
    const videoElements = element.querySelectorAll('video, .internal-embed[src$=".mp4"]');
    videoElements.forEach(video => {
      if (video instanceof HTMLVideoElement) {
        video.addEventListener('loadeddata', () => {
          video.play();
          video.pause();
          video.currentTime = 0;
        });

        video.load();
      }
    });
  };

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) {
            processVideos(node);
          }
        });
      }
    });
  });

  processVideos(element);
  observer.observe(element, { childList: true, subtree: true });
}
