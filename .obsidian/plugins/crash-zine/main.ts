import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TextComponent } from 'obsidian';

// Remember to rename these classes and interfaces!

interface ZineSettings {
	zineFolder: string;
}

const DEFAULT_SETTINGS: ZineSettings = {
	zineFolder: 'zines'
}

interface ZineInfo {
	title: string;
	subject: string;
	size: string;
	pages: number;
}

export default class ZinePlugin extends Plugin {
	settings: ZineSettings;

	private toKebabCase(str: string): string {
		return str
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');
	}

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// Add command to create new zine
		this.addCommand({
			id: 'create-new-zine',
			name: 'Create New Zine',
			callback: () => {
				new CreateZineModal(this.app, this).open();
			}
		});

		// Add command to create "Tell me About" zine
		this.addCommand({
			id: 'create-tell-me-about-zine',
			name: 'Create a Tell me About Zine',
			callback: () => {
				new CreateTellMeAboutZineModal(this.app, this).open();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ZineSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async createZinePages(zineInfo: ZineInfo) {
		const folderPath = `${this.settings.zineFolder}/${zineInfo.title}`;
		const kebabTitle = this.toKebabCase(zineInfo.title);
		const contentPages = zineInfo.pages - 3;
		
		// Create zine folder if it doesn't exist
		try {
			await this.app.vault.createFolder(folderPath);
		} catch (error) {
			// Folder might already exist
		}

		const createYamlFrontMatter = (pageType: string) => {
			return `---
size: ${zineInfo.size}
type: ${pageType}
tags: [zine, ${kebabTitle}]
---

`;
		};

		// Check if this is a "Tell me About" template (8 pages)
		if (zineInfo.pages === 8) {
			// Create template pages
			await this.app.vault.create(
				`${folderPath}/${kebabTitle}-cover.md`,
				createYamlFrontMatter('cover') + `# Tell me About\n\n## ${zineInfo.subject}\n\nSize: ${zineInfo.size}\nPages: ${zineInfo.pages}`
			);

			await this.app.vault.create(
				`${folderPath}/${kebabTitle}-index.md`,
				createYamlFrontMatter('index') + `# Index\n\n1. [[${kebabTitle}-cover|Tell me About]]\n2. [[${kebabTitle}-what-is-it|So... what is it?]]\n3. [[${kebabTitle}-why-love-it|Why do you love it?]]\n4. [[${kebabTitle}-fun-fact|Give me one fun fact]]\n5. [[${kebabTitle}-misconception|What's a common misconception]]\n6. [[${kebabTitle}-what-else|What else should we know]]\n7. [[${kebabTitle}-back-cover|Back Cover]]`
			);

			await this.app.vault.create(
				`${folderPath}/${kebabTitle}-what-is-it.md`,
				createYamlFrontMatter('content') + `# So... what is it?\n\n*Start with the most essential information about your subject. What is it at its core? What makes it unique?*\n\n`
			);

			await this.app.vault.create(
				`${folderPath}/${kebabTitle}-why-love-it.md`,
				createYamlFrontMatter('content') + `# Why do you love it?\n\n*Share your personal connection and passion. What drew you to this subject? What keeps you interested?*\n\n`
			);

			await this.app.vault.create(
				`${folderPath}/${kebabTitle}-fun-fact.md`,
				createYamlFrontMatter('content') + `# Give me one fun fact\n\n*Share something surprising or unexpected that makes this subject interesting. What's a detail that most people don't know?*\n\n`
			);

			await this.app.vault.create(
				`${folderPath}/${kebabTitle}-misconception.md`,
				createYamlFrontMatter('content') + `# What's a common misconception\n\n*What do people often get wrong about this subject? What's the truth behind the myth?*\n\n`
			);

			await this.app.vault.create(
				`${folderPath}/${kebabTitle}-what-else.md`,
				createYamlFrontMatter('content') + `# What else should we know\n\n*What additional context or information would help someone understand this subject better? What's the bigger picture?*\n\n`
			);

			await this.app.vault.create(
				`${folderPath}/${kebabTitle}-back-cover.md`,
				createYamlFrontMatter('back-cover') + `# Back Cover\n\n*Add your contact information, social media, or any other details you'd like to share.*\n\n`
			);
		} else {
			// Original non-template creation logic
			await this.app.vault.create(
				`${folderPath}/${kebabTitle}-cover.md`,
				createYamlFrontMatter('cover') + `# ${zineInfo.title}\n\n## ${zineInfo.subject}\n\nSize: ${zineInfo.size}\nPages: ${zineInfo.pages}`
			);

			// Create index with links
			let indexContent = `# Index\n\n1. [[${kebabTitle}-cover|Cover]]\n`;
			for (let i = 1; i <= contentPages; i++) {
				indexContent += `${i + 1}. [[${kebabTitle}-page-${i}|Page ${i}]]\n`;
			}
			indexContent += `${zineInfo.pages}. [[${kebabTitle}-back-cover|Back Cover]]`;

			await this.app.vault.create(
				`${folderPath}/${kebabTitle}-index.md`,
				createYamlFrontMatter('index') + indexContent
			);

			for (let i = 1; i <= contentPages; i++) {
				await this.app.vault.create(
					`${folderPath}/${kebabTitle}-page-${i}.md`,
					createYamlFrontMatter('content') + `# Page ${i}\n\n`
				);
			}

			await this.app.vault.create(
				`${folderPath}/${kebabTitle}-back-cover.md`,
				createYamlFrontMatter('back-cover') + `# Back Cover\n\n`
			);
		}

		new Notice(`Created new zine: ${zineInfo.title}`);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class CreateZineModal extends Modal {
	plugin: ZinePlugin;
	title: string = '';
	subject: string = '';
	size: string = 'A4';
	pages: number = 4;

	constructor(app: App, plugin: ZinePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();

		contentEl.createEl('h2', {text: 'Create New Zine'});

		// Title input
		new Setting(contentEl)
			.setName('Title')
			.addText(text => text
				.setPlaceholder('Enter zine title')
				.onChange(value => this.title = value));

		// Subject input
		new Setting(contentEl)
			.setName('Subject')
			.addText(text => text
				.setPlaceholder('Enter zine subject')
				.onChange(value => this.subject = value));

		// Size selection
		new Setting(contentEl)
			.setName('Size')
			.addDropdown(dropdown => dropdown
				.addOption('A4', 'A4')
				.addOption('A5', 'A5')
				.addOption('Letter', 'Letter')
				.setValue(this.size)
				.onChange(value => this.size = value));

		// Pages selection
		new Setting(contentEl)
			.setName('Number of Pages')
			.addDropdown(dropdown => dropdown
				.addOption('4', '4 pages')
				.addOption('8', '8 pages')
				.addOption('16', '16 pages')
				.addOption('32', '32 pages')
				.addOption('64', '64 pages')
				.setValue(this.pages.toString())
				.onChange(value => {
					this.pages = parseInt(value);
				}));

		// Create button
		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('Create Zine')
				.onClick(async () => {
					if (!this.title || !this.subject) {
						new Notice('Please fill in all fields');
						return;
					}
					await this.plugin.createZinePages({
						title: this.title,
						subject: this.subject,
						size: this.size,
						pages: this.pages
					});
					this.close();
				}));
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class CreateTellMeAboutZineModal extends Modal {
	plugin: ZinePlugin;
	title: string = '';
	subject: string = '';
	size: string = 'A4';

	constructor(app: App, plugin: ZinePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();

		contentEl.createEl('h2', {text: 'Create a Tell me About Zine'});

		// Title input
		new Setting(contentEl)
			.setName('Title')
			.addText(text => text
				.setPlaceholder('Enter zine title')
				.onChange(value => this.title = value));

		// Subject input
		new Setting(contentEl)
			.setName('Subject')
			.addText(text => text
				.setPlaceholder('Enter zine subject')
				.onChange(value => this.subject = value));

		// Size selection
		new Setting(contentEl)
			.setName('Size')
			.addDropdown(dropdown => dropdown
				.addOption('A4', 'A4')
				.addOption('A5', 'A5')
				.addOption('Letter', 'Letter')
				.setValue(this.size)
				.onChange(value => this.size = value));

		// Create button
		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('Create Zine')
				.onClick(async () => {
					if (!this.title || !this.subject) {
						new Notice('Please fill in all fields');
						return;
					}
					await this.plugin.createZinePages({
						title: this.title,
						subject: this.subject,
						size: this.size,
						pages: 8
					});
					this.close();
				}));
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class ZineSettingTab extends PluginSettingTab {
	plugin: ZinePlugin;

	constructor(app: App, plugin: ZinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Zine Folder')
			.setDesc('The folder where zines will be created')
			.addText(text => text
				.setPlaceholder('Enter folder name')
				.setValue(this.plugin.settings.zineFolder)
				.onChange(async (value) => {
					this.plugin.settings.zineFolder = value;
					await this.plugin.saveSettings();
				}));
	}
}
