export default class ProgressBarEncryption {
  private progressBarContainer: HTMLDivElement;
  private progressBar: HTMLDivElement;
  private text: HTMLDivElement;

  constructor() {
    this.progressBarContainer = document.createElement('div');
    this.progressBarContainer.style.position = 'fixed';
    this.progressBarContainer.style.top = '0';
    this.progressBarContainer.style.left = '50%';
    this.progressBarContainer.style.transform = 'translateX(-50%)';
    this.progressBarContainer.style.width = '100%';
    this.progressBarContainer.style.backgroundColor = '#f3f3f3';
    this.progressBarContainer.style.zIndex = '1000';
    this.progressBarContainer.hide();

    this.progressBar = document.createElement('div');
    this.progressBar.style.width = '0%';
    this.progressBar.style.height = '3px';
    this.progressBar.style.backgroundColor = '#4caf50';
    this.progressBar.style.borderRadius = '5px';
    this.progressBarContainer.appendChild(this.progressBar);

    this.text = document.createElement('div');
    this.text.style.position = 'absolute';
    this.text.style.left = '0';
    this.text.style.top = '100%';
    this.text.style.fontSize = '1rem';
    this.text.style.color = '#fff';
    this.progressBar.appendChild(this.text);

    document.body.appendChild(this.progressBarContainer);
  }

  show() {
    this.progressBarContainer.show();
  }

  update(progress: number, text: string) {
    this.progressBar.style.width = `${progress}%`;
    this.text.innerText = text;
  }

  hide() {
    this.progressBarContainer.hide();
  }
}
