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
    readingData: any;
  };

  passwordCreator: boolean;
  passwordCreatorMixedContent: string;
  passwordCreatorLength: number;

  polysemy: boolean;

  searchForWords: boolean;
  wordsSaveFolder: string;
  cardSaveFolder: string;

  flip: boolean;
  fileCorrect: number;

  fullScreenMode: boolean;
  fullScreenModeStatus: boolean;

  readDataTracking: boolean;
  readDataTrackingFolder: string;
  readDataTrackingTimeout: number;
  readDataTrackingSync: boolean;

  highlight: boolean;

  dialogue: boolean;

  characterRelationships: boolean;
  characterRelationshipsFolder: string;

  readingNotes: boolean;
  readingNotesToFolder: string;
  outLink: boolean;
  blockId: boolean;
  frontmatter: boolean;
  discuss: boolean;
  syncDate: boolean;

  reviewOfReadingNotes: boolean;

  readingPageStyles: boolean;
  fontSize: number;

  chat: boolean;
  chatUrl: string;
  chatKey: string;
  chatModel: string;
  chatPromptFolder: string;
  chatSaveFolder: string;
  chatDefaultUsingR1: boolean;

  chatWebPageClipping: boolean;
  chatWebPageClippingFolder: string;
  chatWebPageClippingSummaryTopUp: boolean;

  completion: boolean;
  completionDelay: number;
  completionMaxLength: number;

  blockReference: boolean;

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

  poster: boolean;

  footnoteRenumbering: boolean;

  gitChart: boolean;
  gitChartMultiColorLabel: boolean;
  gitChartPartition: boolean;
  gitChartPartitionFolding: boolean;

  sandbox: boolean;
  sandboxFolder: string;

  resourceTo: boolean;
  searchForPlants: boolean;
  searchForPlantsFolder: string;
  videoLinkFormat: boolean;
  switchLibrary: boolean;
  bilibiliAISummaryFormat: boolean;
  bilibiliAISummaryFormatFolder: string;
}

export const DEFAULT_SETTINGS: ToolboxSettings = {
  plugins: {
    encryption: {},
    readingData: {}
  },

  passwordCreator: false,
  passwordCreatorMixedContent: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+',
  passwordCreatorLength: 16,
  polysemy: false,
  searchForWords: false,
  wordsSaveFolder: '',
  cardSaveFolder: '',

  flip: false,
  fileCorrect: -35,

  fullScreenMode: false,
  fullScreenModeStatus: false,

  readDataTracking: false,
  readDataTrackingFolder: '书库',
  readDataTrackingTimeout: 300 * 1000,
  readDataTrackingSync: true,

  highlight: false,

  dialogue: false,

  characterRelationships: false,
  characterRelationshipsFolder: '书库/人物关系',

  readingNotes: false,
  readingNotesToFolder: '书库/读书笔记',
  outLink: true,
  blockId: true,
  frontmatter: true,
  discuss: true,
  syncDate: false,

  reviewOfReadingNotes: false,

  readingPageStyles: false,
  fontSize: 36,

  chat: false,
  chatUrl: 'https://api.deepseek.com/beta',
  chatKey: '',
  chatModel: 'deepseek-chat',
  chatPromptFolder: '',
  chatSaveFolder: '',
  chatDefaultUsingR1: false,

  chatWebPageClipping: false,
  chatWebPageClippingFolder: '',
  chatWebPageClippingSummaryTopUp: false,

  completion: false,
  completionDelay: 100,
  completionMaxLength: 128,

  blockReference: false,

  encryption: false,
  encryptionSupportImage: true,
  encryptionImageCompress: false,
  encryptionImageCompressMaxSize: 2,
  encryptionImageCompressLongScreenshotRatio: 3,
  encryptionImageCompressPreserveExif: true,
  encryptionSupportVideo: false,
  encryptionChunkSize: 1024 * 1024 * 1024,
  encryptionRememberPassMode: 'notSave',

  gallery: false,

  poster: false,

  footnoteRenumbering: false,

  gitChart: false,
  gitChartMultiColorLabel: false,
  gitChartPartition: false,
  gitChartPartitionFolding: false,

  sandbox: false,
  sandboxFolder: '',

  resourceTo: false,
  searchForPlants: false,
  searchForPlantsFolder: '',
  videoLinkFormat: false,
  switchLibrary: false,
  bilibiliAISummaryFormat: false,
  bilibiliAISummaryFormatFolder: ''
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
    new Setting(containerEl)
      .setName('🕐 阅读数据跟踪')
      .setDesc('阅读进度、时长，未读以及读完')
      .setHeading()
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

      const setting = new Setting(containerEl)
        .setName(`超时 (${this.plugin.settings.readDataTrackingTimeout / 36000}m)`)
        .setDesc(`超过一段时间未翻页将暂停跟踪阅读时长，以获得更准确的数据。`)
        .addSlider(slider =>
          slider
            .setLimits(36000 * 5, 360000, 36000)
            .setValue(this.plugin.settings.readDataTrackingTimeout)
            .onChange(async value => {
              this.plugin.settings.readDataTrackingTimeout = Number(value);
              await this.plugin.saveSettings();
              setting.setName(`超时 (${value / 36000}m)`);
            })
        );

      new Setting(containerEl)
        .setName('实时同步')
        .setDesc('在某些老旧水墨屏设备或者单文件体积过大，每次实时同步跟踪数据都会导致翻页明显滞后，请关闭此选项')
        .setHeading()
        .addToggle(cd =>
          cd.setValue(this.plugin.settings.readDataTrackingSync).onChange(async value => {
            this.plugin.settings.readDataTrackingSync = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }

    new Setting(containerEl)
      .setName('👇🏼 翻页')
      .setDesc('（移动端）点击翻页，左滑下翻，右滑上翻，长按0.5s进入编辑模式，长按2.5s进入全屏模式，收起软键盘进入阅读模式。（桌面端）点击和鼠标滚轮翻页，鼠标右键切换模式')
      .setHeading()
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
      .setHeading()
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.fullScreenMode).onChange(async value => {
          this.plugin.settings.fullScreenMode = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    new Setting(containerEl)
      .setName('🔎 查词')
      .setHeading()
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.searchForWords).onChange(async value => {
          this.plugin.settings.searchForWords = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.searchForWords) {
      new Setting(containerEl).setName('生词放在哪个文件夹？').addText(cd =>
        cd.setValue('' + this.plugin.settings.wordsSaveFolder).onChange(async value => {
          this.plugin.settings.wordsSaveFolder = value;
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('卡片笔记放在哪个文件夹？').addText(cd =>
        cd.setValue('' + this.plugin.settings.cardSaveFolder).onChange(async value => {
          this.plugin.settings.cardSaveFolder = value;
          await this.plugin.saveSettings();
        })
      );
    }

    new Setting(containerEl)
      .setName('✏️ 划线')
      .setHeading()
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.highlight).onChange(async value => {
          this.plugin.settings.highlight = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    new Setting(containerEl)
      .setName('🔔 讨论')
      .setDesc('在当前行下方添加对本章节或本书的见解')
      .setHeading()
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.dialogue).onChange(async value => {
          this.plugin.settings.dialogue = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    new Setting(containerEl)
      .setName('🕵️‍♀️ 人物关系')
      .setHeading()
      .setDesc('根据阅读进度创建多张人物关系的 mermaid 图')
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.characterRelationships).onChange(async value => {
          this.plugin.settings.characterRelationships = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.characterRelationships) {
      new Setting(containerEl).setName('跟踪哪个文件夹').addText(cd =>
        cd.setValue('' + this.plugin.settings.characterRelationshipsFolder).onChange(async value => {
          this.plugin.settings.characterRelationshipsFolder = value;
          await this.plugin.saveSettings();
        })
      );
    }

    new Setting(containerEl)
      .setName('📙 同步读书笔记')
      .setHeading()
      .addToggle(cd =>
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

      new Setting(containerEl).setName('同步讨论').addToggle(cd =>
        cd.setValue(this.plugin.settings.discuss).onChange(async value => {
          this.plugin.settings.discuss = value;
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

      new Setting(containerEl).setName('同步日期').addToggle(cd =>
        cd.setValue(this.plugin.settings.syncDate).onChange(async value => {
          this.plugin.settings.syncDate = value;
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

    new Setting(containerEl)
      .setName('🎈 阅读页面')
      .setHeading()
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.readingPageStyles).onChange(async value => {
          this.plugin.settings.readingPageStyles = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.readingPageStyles) {
      const setting = new Setting(containerEl).setName(`字体大小 (${this.plugin.settings.fontSize}px)`).addSlider(slider =>
        slider
          .setLimits(18, 46, 1)
          .setValue(this.plugin.settings.fontSize)
          .onChange(async value => {
            this.plugin.settings.fontSize = Number(value);
            await this.plugin.saveSettings();
            setting.setName(`字体大小 (${value}px)`);
          })
      );
    }

    new Setting(containerEl)
      .setName('📖 读书笔记回顾')
      .setHeading()
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.reviewOfReadingNotes).onChange(async value => {
          this.plugin.settings.reviewOfReadingNotes = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    const AIChatEl = new Setting(containerEl).setName('🤖 AI Chat').setHeading();
    AIChatEl.addToggle(cd =>
      cd.setValue(this.plugin.settings.chat).onChange(async value => {
        this.plugin.settings.chat = value;
        await this.plugin.saveSettings();
        this.display();
      })
    );

    if (this.plugin.settings.chat) {
      if (this.plugin.settings.chatUrl.indexOf('deepseek') > -1) {
        const url = 'https://api.deepseek.com/user/balance';
        let config = {
          method: 'get',
          maxBodyLength: Infinity,
          url: 'https://api.deepseek.com/user/balance',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${this.plugin.settings.chatKey}`
          }
        };

        fetch(url, config).then(response => {
          if (response.ok) {
            response.json().then(data => {
              AIChatEl.nameEl.innerText = `🤖 AI Chat（${data.balance_infos[0].total_balance} ${data.balance_infos[0].currency}）`;
            });
          }
        });
      }

      new Setting(containerEl).setName('Url').addText(cd =>
        cd.setValue('' + this.plugin.settings.chatUrl).onChange(async value => {
          this.plugin.settings.chatUrl = value;
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('Key').addText(cd =>
        cd.setValue('' + this.plugin.settings.chatKey).onChange(async value => {
          this.plugin.settings.chatKey = value;
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('Model').addText(cd =>
        cd.setValue('' + this.plugin.settings.chatModel).onChange(async value => {
          this.plugin.settings.chatModel = value;
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('Promats Folder').addText(cd =>
        cd.setValue('' + this.plugin.settings.chatPromptFolder).onChange(async value => {
          this.plugin.settings.chatPromptFolder = value;
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('将对话保存至哪个文件夹').addText(cd =>
        cd.setValue('' + this.plugin.settings.chatSaveFolder).onChange(async value => {
          this.plugin.settings.chatSaveFolder = value;
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('默认深度思考').addToggle(cd =>
        cd.setValue(this.plugin.settings.chatDefaultUsingR1).onChange(async value => {
          this.plugin.settings.chatDefaultUsingR1 = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

      new Setting(containerEl)
        .setName('网页剪藏')
        .setDesc('为网页剪藏笔记生成核心摘要和吸引人的标题')
        .addToggle(cd =>
          cd.setValue(this.plugin.settings.chatWebPageClipping).onChange(async value => {
            this.plugin.settings.chatWebPageClipping = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      if (this.plugin.settings.chatWebPageClipping) {
        new Setting(containerEl).setName('网页剪藏 - 跟踪文件夹').addTextArea(cd =>
          cd.setValue('' + this.plugin.settings.chatWebPageClippingFolder).onChange(async value => {
            this.plugin.settings.chatWebPageClippingFolder = value;
            await this.plugin.saveSettings();
          })
        );
      }

      new Setting(containerEl)
        .setName('自动补全')
        .setDesc('根据当前段落内容，自动补全接下来的笔记内容。桌面端按空格键补全建议内容插入到光标位置，移动端点击补全建议内容插入到光标位置。')
        .addToggle(cd =>
          cd.setValue(this.plugin.settings.completion).onChange(async value => {
            this.plugin.settings.completion = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      if (this.plugin.settings.completion) {
        new Setting(containerEl)
          .setName('自动补全 - 延迟（ms）')
          .setDesc('不低于 100ms')
          .addText(cd =>
            cd.setValue('' + this.plugin.settings.completionDelay).onChange(async value => {
              this.plugin.settings.completionDelay = Number(value);
              await this.plugin.saveSettings();
            })
          );

        new Setting(containerEl).setName('自动补全 - 最大字节').addText(cd =>
          cd.setValue('' + this.plugin.settings.completionMaxLength).onChange(async value => {
            this.plugin.settings.completionMaxLength = Number(value);
            await this.plugin.saveSettings();
          })
        );
      }
    }

    new Setting(containerEl)
      .setName('🔒 笔记加密')
      .setDesc('本功能还处于测试阶段，请做好备份，避免因意外情况导致数据损坏或丢失。')
      .setHeading()
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
          new Setting(containerEl).setName('压缩图片 - 压缩后的图片大小尽量不超过（mb）').addText(cd =>
            cd.setValue('' + this.plugin.settings.encryptionImageCompressMaxSize).onChange(async value => {
              this.plugin.settings.encryptionImageCompressMaxSize = Number(value);
              await this.plugin.saveSettings();
            })
          );

          new Setting(containerEl)
            .setName('压缩图片 - 长图比率')
            .setDesc('对长图进行浅压缩，以避免过于模糊')
            .addText(cd =>
              cd.setValue('' + this.plugin.settings.encryptionImageCompressLongScreenshotRatio).onChange(async value => {
                this.plugin.settings.encryptionImageCompressLongScreenshotRatio = Number(value);
                await this.plugin.saveSettings();
              })
            );

          new Setting(containerEl)
            .setName('压缩图片 - 保留exif')
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

    new Setting(containerEl)
      .setName('🔑 密码创建器')
      .setHeading()
      .addToggle(cd =>
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
      .setHeading()
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
      .setHeading()
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.blockReference).onChange(async value => {
          this.plugin.settings.blockReference = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    new Setting(containerEl)
      .setName('📸 画廊')
      .setHeading()
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.gallery).onChange(async value => {
          this.plugin.settings.gallery = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (Platform.isMobile) {
      new Setting(containerEl)
        .setName('🏞️ 海报')
        .setDesc('将视频第一帧作为海报')
        .setHeading()
        .addToggle(cd =>
          cd.setValue(this.plugin.settings.poster).onChange(async value => {
            this.plugin.settings.poster = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }

    new Setting(containerEl)
      .setName('🧮 Mermaid GitGraph')
      .setDesc('将无序列表生成 Mermaid GitGraph')
      .setHeading()
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.gitChart).onChange(async value => {
          this.plugin.settings.gitChart = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.gitChart) {
      new Setting(containerEl)
        .setName('彩色文本')
        .setDesc('文本颜色跟随分支颜色')
        .addToggle(cd =>
          cd.setValue(this.plugin.settings.gitChartMultiColorLabel).onChange(async value => {
            this.plugin.settings.gitChartMultiColorLabel = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      new Setting(containerEl)
        .setName('分区')
        .setDesc('当生成完整图表时，根据子列表分成多个图表')
        .addToggle(cd =>
          cd.setValue(this.plugin.settings.gitChartPartition).onChange(async value => {
            this.plugin.settings.gitChartPartition = value;
            this.plugin.settings.gitChartPartitionFolding = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      if (this.plugin.settings.gitChartPartition) {
        new Setting(containerEl)
          .setName('分区 - 默认折叠')
          .setDesc('提升渲染性能')
          .addToggle(cd =>
            cd.setValue(this.plugin.settings.gitChartPartitionFolding).onChange(async value => {
              this.plugin.settings.gitChartPartitionFolding = value;
              await this.plugin.saveSettings();
              this.display();
            })
          );
      }
    }

    new Setting(containerEl)
      .setName('📦 沙箱（Beta）')
      .setDesc('外部脚本注入，可实现更丰富的功能')
      .setHeading()
      .addToggle(cd =>
        cd.setValue(this.plugin.settings.sandbox).onChange(async value => {
          this.plugin.settings.sandbox = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.sandbox) {
      new Setting(containerEl).setName('脚本所在文件夹').addText(cd =>
        cd.setValue('' + this.plugin.settings.sandboxFolder).onChange(async value => {
          this.plugin.settings.sandboxFolder = value;
          await this.plugin.saveSettings();
        })
      );
    }
  }
}
