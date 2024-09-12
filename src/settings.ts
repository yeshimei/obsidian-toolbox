import { App, Platform, PluginSettingTab, Setting } from 'obsidian';
import Toolbox from './main';

export interface ToolboxSettings {
  // 插件数据
  plugins: {
    encryption: {
      [path: string]: {
        pass?: string;
        links?: string[];
      };
    };
  };

  passwordCreator: boolean;
  passwordCreatorMixedContent: string;
  passwordCreatorLength: number;

  polysemy: boolean;

  footnoteRenumbering: boolean;

  searchForWords: boolean;

  flip: boolean;
  fileCorrect: number;

  fullScreenMode: boolean;

  readDataTracking: boolean;
  readDataTrackingFolder: string;
  readDataTrackingTimeout: number;
  readDataTrackingDelayTime: number;

  highlight: boolean;

  dialogue: boolean;

  readingNotes: boolean;
  readingNotesToFolder: string;
  outLink: boolean;
  blockId: boolean;
  frontmatter: boolean;

  reviewOfReadingNotes: boolean;

  readingPageStyles: boolean;
  fontSize: number;

  blockReference: boolean;

  searchForPlants: boolean;
  searchForPlantsFolder: string;

  encryption: boolean;
  encryptionSupportImage: boolean;
  encryptionImageCompress: boolean;
  encryptionImageCompressMaxSize: number;
  encryptionImageCompressLongScreenshotRatio: number;
  encryptionImageCompressPreserveExif: boolean;

  encryptionSupportVideo: boolean;
  encryptionChunkSize: number;
  encryptionRememberPassMode: 'always' | 'disposable' | 'notSave';

  gallery: boolean;

  cleanClipboardContent: boolean;

  poster: boolean;

  moveResourcesTo: boolean;
}

export const DEFAULT_SETTINGS: ToolboxSettings = {
  plugins: {
    encryption: {}
  },

  passwordCreator: true,
  passwordCreatorMixedContent: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+',
  passwordCreatorLength: 16,
  polysemy: true,
  footnoteRenumbering: true,
  searchForWords: true,

  flip: true,
  fileCorrect: -35,

  fullScreenMode: false,

  readDataTracking: true,
  readDataTrackingFolder: '书库',
  readDataTrackingTimeout: 300 * 1000,
  readDataTrackingDelayTime: 3 * 1000,

  highlight: true,

  dialogue: true,

  readingNotes: true,
  readingNotesToFolder: '书库/读书笔记',
  outLink: true,
  blockId: true,
  frontmatter: true,

  reviewOfReadingNotes: true,

  readingPageStyles: true,
  fontSize: 36,

  blockReference: true,

  searchForPlants: true,
  searchForPlantsFolder: '卡片盒/归档',

  encryption: true,
  encryptionSupportImage: true,
  encryptionImageCompress: false,
  encryptionImageCompressMaxSize: 2,
  encryptionImageCompressLongScreenshotRatio: 3,
  encryptionImageCompressPreserveExif: true,
  encryptionSupportVideo: false,
  encryptionChunkSize: 1024 * 1024 * 1024,
  encryptionRememberPassMode: 'notSave',

  gallery: true,

  cleanClipboardContent: true,

  poster: true,

  moveResourcesTo: true
};

export class ToolboxSettingTab extends PluginSettingTab {
  plugin: Toolbox;

  constructor(app: App, plugin: Toolbox) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    let { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h1', { text: this.plugin.manifest.name });

    if (Platform.isMobile) {
      new Setting(containerEl)
        .setName('🕐 阅读数据跟踪')
        .setDesc('阅读进度、时长，未读以及读完')
        .addToggle(cd =>
          cd.setValue(this.plugin.settings.readDataTracking).onChange(async value => {
            this.plugin.settings.readDataTracking = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      if (this.plugin.settings.readDataTracking) {
        new Setting(containerEl).setName('跟踪哪个文件夹').addText(cd =>
          cd.setValue('' + this.plugin.settings.readDataTrackingFolder).onChange(async value => {
            this.plugin.settings.readDataTrackingFolder = value;
            await this.plugin.saveSettings();
          })
        );

        new Setting(containerEl)
          .setName('超时')
          .setDesc(`超过一段时间未翻页将暂停跟踪阅读时长，以获得更准确的数据。`)
          .addText(cd =>
            cd.setValue('' + this.plugin.settings.readDataTrackingTimeout).onChange(async value => {
              this.plugin.settings.readDataTrackingTimeout = Number(value);
              await this.plugin.saveSettings();
            })
          );

        new Setting(containerEl)
          .setName('跟踪数据延迟更新')
          .setDesc('在某些老旧水墨屏设备或者单文件体积过大，每次更新跟踪数据都会导致翻页明显滞后，设置延迟以大幅提升翻页流畅性')
          .addText(text =>
            text.setValue('' + this.plugin.settings.readDataTrackingDelayTime).onChange(async value => {
              this.plugin.settings.readDataTrackingDelayTime = Number(value);
              await this.plugin.saveSettings();
            })
          );
      }

      new Setting(containerEl)
        .setName('👇🏼 翻页')
        .setDesc('点击下翻，左滑下翻，右滑上翻，长按0.5s进入编辑模式，收起软键盘进入阅读模式')
        .addToggle(cd =>
          cd.setValue(this.plugin.settings.flip).onChange(async value => {
            this.plugin.settings.flip = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      if (this.plugin.settings.flip) {
        new Setting(containerEl).setName('修正值').addText(cd =>
          cd.setValue('' + this.plugin.settings.fileCorrect).onChange(async value => {
            this.plugin.settings.fileCorrect = Number(value);
            await this.plugin.saveSettings();
          })
        );
      }

      new Setting(containerEl)
        .setName('🤗 全屏模式')
        .setDesc('长按 2.5s 打开或关闭全屏模式')
        .addToggle(cd =>
          cd.setValue(this.plugin.settings.fullScreenMode).onChange(async value => {
            this.plugin.settings.fullScreenMode = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      new Setting(containerEl).setName('🔎 查词').addToggle(cd =>
        cd.setValue(this.plugin.settings.searchForWords).onChange(async value => {
          this.plugin.settings.searchForWords = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

      new Setting(containerEl).setName('✏️ 划线').addToggle(cd =>
        cd.setValue(this.plugin.settings.highlight).onChange(async value => {
          this.plugin.settings.highlight = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

      new Setting(containerEl)
        .setName('🔔 讨论')
        .setDesc('在当前行下方添加对本章节或本书的见解')
        .addToggle(cd =>
          cd.setValue(this.plugin.settings.dialogue).onChange(async value => {
            this.plugin.settings.dialogue = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      new Setting(containerEl).setName('📙 同步读书笔记').addToggle(cd =>
        cd.setValue(this.plugin.settings.readingNotes).onChange(async value => {
          this.plugin.settings.readingNotes = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

      if (this.plugin.settings.readingNotes) {
        new Setting(containerEl).setName('同步至哪个文件夹').addText(cd =>
          cd.setValue('' + this.plugin.settings.readingNotesToFolder).onChange(async value => {
            this.plugin.settings.readingNotesToFolder = value;
            await this.plugin.saveSettings();
          })
        );

        new Setting(containerEl).setName('同步出链').addToggle(cd =>
          cd.setValue(this.plugin.settings.outLink).onChange(async value => {
            this.plugin.settings.outLink = value;
            await this.plugin.saveSettings();
          })
        );

        new Setting(containerEl)
          .setName('同步元字段')
          .setDesc('添加划线，想法和出链数量元字段')
          .addToggle(cd =>
            cd.setValue(this.plugin.settings.frontmatter).onChange(async value => {
              this.plugin.settings.frontmatter = value;
              await this.plugin.saveSettings();
            })
          );

        new Setting(containerEl).setName('添加块id').addToggle(cd =>
          cd.setValue(this.plugin.settings.blockId).onChange(async value => {
            this.plugin.settings.blockId = value;
            await this.plugin.saveSettings();
          })
        );
      }

      new Setting(containerEl).setName('🎈 阅读页面').addToggle(cd =>
        cd.setValue(this.plugin.settings.readingPageStyles).onChange(async value => {
          this.plugin.settings.readingPageStyles = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

      if (this.plugin.settings.readingPageStyles) {
        new Setting(containerEl).setName('字体大小').addText(cd =>
          cd.setValue('' + this.plugin.settings.fontSize).onChange(async value => {
            this.plugin.settings.fontSize = Number(value);
            await this.plugin.saveSettings();
          })
        );
      }
    }

    new Setting(containerEl).setName('📖 读书笔记回顾').addToggle(cd =>
      cd.setValue(this.plugin.settings.reviewOfReadingNotes).onChange(async value => {
        this.plugin.settings.reviewOfReadingNotes = value;
        await this.plugin.saveSettings();
        this.display();
      })
    );

    new Setting(containerEl).setName('🔑 密码创建器').addToggle(cd =>
      cd.setValue(this.plugin.settings.passwordCreator).onChange(async value => {
        this.plugin.settings.passwordCreator = value;
        await this.plugin.saveSettings();
        this.display();
      })
    );

    if (this.plugin.settings.passwordCreator) {
      new Setting(containerEl).setName('从指定字符集中随机生成密码').addText(cd =>
        cd.setValue('' + this.plugin.settings.passwordCreatorMixedContent).onChange(async value => {
          this.plugin.settings.passwordCreatorMixedContent = value;
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('生成密码的长度').addText(cd =>
        cd.setValue('' + this.plugin.settings.passwordCreatorLength).onChange(async value => {
          this.plugin.settings.passwordCreatorLength = Number(value);
          await this.plugin.saveSettings();
        })
      );
    }

    new Setting(containerEl)
      .setName('🔗 多义笔记转跳')
      .setDesc('to: "[[filename or path]]"')
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.polysemy).onChange(async value => {
          this.plugin.settings.polysemy = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    new Setting(containerEl).setName('🏷️ 脚注重编号').addToggle(cd =>
      cd.setValue(this.plugin.settings.footnoteRenumbering).onChange(async value => {
        this.plugin.settings.footnoteRenumbering = value;
        await this.plugin.saveSettings();
        this.display();
      })
    );

    new Setting(containerEl)
      .setName('📌 块引用')
      .setDesc('获取光标所在行（块）的双链，方便复制到地方使用')
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.blockReference).onChange(async value => {
          this.plugin.settings.blockReference = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    new Setting(containerEl)
      .setName('🏵️ 查植物')
      .setDesc('')
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.searchForPlants).onChange(async value => {
          this.plugin.settings.searchForPlants = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.readDataTracking) {
      new Setting(containerEl).setName('放至哪个文件夹').addText(cd =>
        cd.setValue('' + this.plugin.settings.searchForPlantsFolder).onChange(async value => {
          this.plugin.settings.searchForPlantsFolder = value;
          await this.plugin.saveSettings();
        })
      );
    }

    new Setting(containerEl)
      .setName('🔒 笔记加密')
      .setDesc('本功能还处于测试阶段，请做好备份，避免因意外情况导致数据损坏或丢失。')
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.encryption).onChange(async value => {
          this.plugin.settings.encryption = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.encryption) {
      new Setting(containerEl).setName('记住密码').addDropdown(cd =>
        cd
          .addOption('notSave', '不保存')
          .addOption('disposable', '软件运行时')
          .addOption('always', '永久')
          .setValue(this.plugin.settings.encryptionRememberPassMode)
          .onChange(async value => {
            this.plugin.settings.encryptionRememberPassMode = value as 'always' | 'disposable' | 'notSave';
            await this.plugin.saveSettings();
            this.display();
          })
      );

      new Setting(containerEl).setName('支持图片').addToggle(cd =>
        cd.setValue(this.plugin.settings.encryptionSupportImage).onChange(async value => {
          this.plugin.settings.encryptionSupportImage = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

      if (this.plugin.settings.encryptionSupportImage) {
        new Setting(containerEl)
          .setName('压缩图片')
          .setDesc('有损压缩，大幅提升加解密速度。开启此选项，原图将备份，笔记内的图片换为压缩图，首次加密会耗时更长。关闭此选项，再进行一次加密或解密后还原原图。')
          .addToggle(cd =>
            cd.setValue(this.plugin.settings.encryptionImageCompress).onChange(async value => {
              this.plugin.settings.encryptionImageCompress = value;
              await this.plugin.saveSettings();
              this.display();
            })
          );

        if (this.plugin.settings.encryptionImageCompress) {
          new Setting(containerEl).setName('压缩后的图片大小尽量不超过（mb）').addText(cd =>
            cd.setValue('' + this.plugin.settings.encryptionImageCompressMaxSize).onChange(async value => {
              this.plugin.settings.encryptionImageCompressMaxSize = Number(value);
              await this.plugin.saveSettings();
            })
          );

          new Setting(containerEl)
            .setName('长图比率')
            .setDesc('对长图进行浅压缩，以避免过于模糊')
            .addText(cd =>
              cd.setValue('' + this.plugin.settings.encryptionImageCompressLongScreenshotRatio).onChange(async value => {
                this.plugin.settings.encryptionImageCompressLongScreenshotRatio = Number(value);
                await this.plugin.saveSettings();
              })
            );

          new Setting(containerEl)
            .setName('保留exif')
            .setDesc('图像的元数据。如焦距，地理位置信息等')
            .addToggle(cd =>
              cd.setValue(this.plugin.settings.encryptionImageCompressPreserveExif).onChange(async value => {
                this.plugin.settings.encryptionImageCompressPreserveExif = value;
                await this.plugin.saveSettings();
                this.display();
              })
            );
        }
      }

      new Setting(containerEl).setName('支持视频').addToggle(cd =>
        cd.setValue(this.plugin.settings.encryptionSupportVideo).onChange(async value => {
          this.plugin.settings.encryptionSupportVideo = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

      new Setting(containerEl)
        .setName('分块量（mb）')
        .setDesc('桌面端（100-300），移动端（1-5），如果处理器性能优越，值可以更大，用时更短')
        .addText(cd =>
          cd.setValue('' + this.plugin.settings.encryptionChunkSize / 1024 / 1024).onChange(async value => {
            this.plugin.settings.encryptionChunkSize = Number(value) * 1024 * 1024;
            await this.plugin.saveSettings();
          })
        );
    }

    new Setting(containerEl).setName('📸 画廊').addToggle(cd =>
      cd.setValue(this.plugin.settings.gallery).onChange(async value => {
        this.plugin.settings.gallery = value;
        await this.plugin.saveSettings();
        this.display();
      })
    );

    new Setting(containerEl)
      .setName('📀 剪切板文本格式化')
      .setDesc('删除换行，空格和其他空白字符，英文单词以及英文和中文之间保留一个空格')
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.cleanClipboardContent).onChange(async value => {
          this.plugin.settings.cleanClipboardContent = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (Platform.isMobile) {
      new Setting(containerEl)
        .setName('🏞️ 海报')
        .setDesc('将视频第一帧作为海报')
        .addToggle(cd =>
          cd.setValue(this.plugin.settings.poster).onChange(async value => {
            this.plugin.settings.poster = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }

    new Setting(containerEl).setName('🗂️ 移动笔记中的资源至指定文件夹').addToggle(cd =>
      cd.setValue(this.plugin.settings.moveResourcesTo).onChange(async value => {
        this.plugin.settings.moveResourcesTo = value;
        await this.plugin.saveSettings();
        this.display();
      })
    );
  }
}
