import { TFile } from 'obsidian';
import Toolbox from 'src/main';

class Block {
  private static instance: Block;
  private blocks: { name: string; fn: Function }[] = [];
  private constructor() {}

  static getInstance(): Block {
    if (!Block.instance) {
      Block.instance = new Block();
    }
    return Block.instance;
  }

  register(name: string, fn: (args: { [key: string]: string }, file: TFile) => string) {
    this.blocks.push({
      name,
      fn
    });
  }

  async exec(self: Toolbox, file: TFile) {
    let content = await self.app.vault.read(file);
    this.blocks.forEach(({ name, fn }) => {
      const regex = new RegExp(`(?<header>%%${name}(?<paramStringify>.*?)%%).+?(?<footer>%%${name}%%)`, 'gs');
      content = content.replace(regex, (...args) => {
        let { header, footer, paramStringify } = args.pop();
        let match;
        let regex = /(\w+)=(\w+)/g;
        let params: { [key: string]: string } = {};
        while ((match = regex.exec(paramStringify)) !== null) {
          params[match[1]] = match[2];
        }
        const content = fn(params, file);
        return `${header}\n\n${content}\n\n${footer}`;
      });
    });
    await self.app.vault.modify(file, content);
  }
}

export default Block.getInstance();
