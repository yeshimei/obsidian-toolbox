import { Toolbox } from 'src/main';
import { App, TFile } from "obsidian";
import { hasFileOrFolder } from 'src/sandboxHelpers';

let self: Toolbox;

const methods = {
    hasFileOrFolder
}

export function sandbox(f: Toolbox) {
    self = f;
    const runner = new ScriptRunner(self.app, {
      scriptFolder: "Scripts",
      executionOrder: "alphabetical"
    });
    
    runner.registerFileWatcher();
    runner.executeAllScripts();
  }


interface ScriptExecutorConfig {
  scriptFolder: string;
  executionOrder: "alphabetical" | "modifiedTime";
}


export class ScriptRunner {
  private executedScripts = new Set<string>();
  
  constructor(
    private app: App,
    private config: ScriptExecutorConfig = {
      scriptFolder: "Scripts",
      executionOrder: "alphabetical"
    }
  ) {}

  // 主执行入口
  async executeAllScripts() {
    const scripts = await this.loadScriptFiles();
    for (const script of this.sortScripts(scripts)) {
      await this.executeScript(script);
    }
  }

  // 加载脚本文件
  private async loadScriptFiles(): Promise<TFile[]> {
    const validExtensions = new Set(["js", "javascript"]);
    return this.app.vault.getFiles()
      .filter(file => 
        file.path.startsWith(self.settings.sandboxFolder + "/") &&
        validExtensions.has(file.extension)
      );
  }

  // 脚本排序逻辑
  private sortScripts(files: TFile[]): TFile[] {
    switch (this.config.executionOrder) {
      case "alphabetical":
        return [...files].sort((a, b) => 
          a.name.localeCompare(b.name)
        );
      case "modifiedTime":
        return [...files].sort((a, b) => 
          a.stat.mtime - b.stat.mtime
        );
      default:
        return files;
    }
  }

  // 执行单个脚本
  private async executeScript(file: TFile) {
    try {
      const content = await this.app.vault.read(file);
      
      // 防止重复执行（可根据需要关闭）
    //   if (this.executedScripts.has(file.path)) return;
    //   this.executedScripts.add(file.path);

      console.log(`Executing script: ${file.path}`);
      await this.executeWithEval(content, file.path);
    } catch (error) {
      console.error(`Script execution failed: ${file.path}`, error);
    }
  }

  // 增强版执行函数
  private async executeWithEval(code: string, scriptPath: string) {
    const safeEnv = this.createSafeEnvironment();
    
    try {
      const wrappedCode = this.createWrappedCode(code, scriptPath);
      const result = eval(wrappedCode)(safeEnv);
      
      if (result instanceof Promise) {
        await result;
      }
    } catch (e) {
      console.error(`Error in ${scriptPath}:`, e);
    }
  }

  // 创建安全环境
  private createSafeEnvironment() {
    return {
        to: methods,
        app: this.app,
        on: (event: any, callback: (...args: any[]) => any) => {
            this.app.workspace.on(event, callback);
        },
        von: (event: any, callback: (...args: any[]) => any) => {
            this.app.vault.on(event, callback);
        },
      }
      
  }

  // 安全数据访问示例
  private getSafePages(query?: string) {
    // 实现查询过滤逻辑（此处需添加安全限制）
    return this.app.vault.getMarkdownFiles();
  }

  private getSafeFileInfo(path: string) {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file ? { name: file.name, size: file.stat.size } : null;
  }


  // 日志控制
  private createLogger(level: string) {
    return (...args: any[]) => {
      console[level](`[Script]`, ...args);
    };
  }

  // 代码包装器
  private createWrappedCode(rawCode: string, scriptPath: string) {
    return `(function(env) {
      "use strict";
      // 解构需要暴露的 API
      const { to, app, on, von} = env;
      const __filename = "${scriptPath}";
      
      try {
        // 异步立即执行函数
        return (async () => {
          ${rawCode}
        })();
      } catch(e) {
        console.error("Execution error in ${scriptPath}", e);
        throw e;
      }
    })`;
  }
  

  // 文件监听注册
  registerFileWatcher() {
    this.app.vault.on("modify", (file) => {
      if (file.path.startsWith(self.settings.sandboxFolder)) {
        this.executeAllScripts();
      }
    });
  }
}




