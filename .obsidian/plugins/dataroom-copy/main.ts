import {
    App,
    Editor,
    MarkdownView,
    Plugin,
    Notice,
    PluginSettingTab,
    Setting,
} from 'obsidian';
import matter from 'gray-matter';

/**
 * Interface for plugin settings.
 */
interface CopyCodeBlockPluginSettings {
    citationStyle: string;
    memoryCopy: string | null;
}

/**
 * Default settings for the plugin.
 */
const DEFAULT_SETTINGS: CopyCodeBlockPluginSettings = {
    citationStyle: 'APA',
    memoryCopy: null,
};

/**
 * This plugin handles copying selected text with YAML Front Matter,
 * an entire code block, or pasting memory-stored content.
 */
export default class CopyCodeBlockPlugin extends Plugin {
    settings: CopyCodeBlockPluginSettings;

    // To store copied selection or code block with front matter and source note in memory
    // Note: This is now persisted in settings for data persistence across sessions
    private get memoryCopy(): string | null {
        return this.settings.memoryCopy;
    }

    private set memoryCopy(value: string | null) {
        this.settings.memoryCopy = value;
        this.saveSettings();
    }

    /**
     * Triggered when the plugin is loaded by Obsidian.
     */
    async onload() {
        await this.loadSettings();

        this.addSettingTab(new CopyCodeBlockSettingTab(this.app, this));

        // Command to copy selection or code block
        this.addCommand({
            id: 'copy-selection-or-code-block',
            name: 'Copy Selection or Code Block',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                this.copySelectionOrCodeBlock(editor, view);
            },
        });

        // Command to paste from memory
        this.addCommand({
            id: 'paste-memory',
            name: 'Paste Memory',
            editorCallback: (editor: Editor) => {
                this.pasteFromMemory(editor);
            },
        });
    }

    /**
     * Determines whether to copy selection with YAML front matter
     * or an entire code block, then stores the result along with the source note name in memory.
     * @param editor The active editor instance.
     * @param view The active markdown view.
     */
    copySelectionOrCodeBlock(editor: Editor, view: MarkdownView): void {
        const selection = editor.getSelection();
        const noteName = view.file?.basename || 'Unknown';
        if (selection.length > 0) {
            this.copySelectionToMemory(editor, selection, noteName);
        } else {
            this.copyCodeBlockToClipboardAndMemory(editor, noteName);
        }
    }

    /**
     * Copies the selected text with YAML front matter and source note name to memory.
     * @param editor The active editor instance.
     * @param selection The selected text.
     * @param noteName The name of the source note.
     */
    private copySelectionToMemory(editor: Editor, selection: string, noteName: string): void {
        const content = editor.getValue();
        let frontMatter = {};
        
        try {
            const parsed = matter(content);
            frontMatter = parsed.data;
        } catch (error) {
            console.error('YAML parsing error:', error);
            new Notice('Warning: YAML front matter has errors. Using note name for citation.');
            // Use the note name as a fallback for basic citation info
            frontMatter = {
                title: noteName,
                author: 'Unknown',
                year: new Date().getFullYear(),
                publisher: 'Unknown',
                url: 'Unknown'
            };
        }
        
        this.memoryCopy = JSON.stringify({
            selection: selection,
            frontMatter: frontMatter,
            noteName: noteName
        });
        new Notice('Selected text and YAML front matter stored in memory.');
    }

    /**
     * Copies the entire code block at the current cursor position with its source note name
     * to clipboard and memory.
     * @param editor The active editor instance.
     * @param noteName The name of the source note.
     */
    private copyCodeBlockToClipboardAndMemory(editor: Editor, noteName: string): void {
        const doc = editor.getDoc();
        const cursorPosition = editor.getCursor();
        let startLine = cursorPosition.line;
        let endLine = cursorPosition.line;
        const lineCount = doc.lineCount();

        // Traverse upwards to find the start of the code block
        while (startLine >= 0 && !doc.getLine(startLine).trim().startsWith('```')) {
            startLine--;
        }

        // Traverse downwards to find the end of the code block
        while (endLine < lineCount && !doc.getLine(endLine).trim().startsWith('```')) {
            endLine++;
        }

        // Check for valid code block
        if (startLine >= 0 && endLine < lineCount && startLine !== endLine) {
            let codeBlockContent = '';
            for (let i = startLine + 1; i < endLine; i++) {
                codeBlockContent += doc.getLine(i) + '\n';
            }

            // Store code block content with YAML front matter and source note name in memory
            const content = editor.getValue();
            let frontMatter = {};
            
            try {
                const parsed = matter(content);
                frontMatter = parsed.data;
            } catch (error) {
                console.error('YAML parsing error:', error);
                new Notice('Warning: YAML front matter has errors. Using note name for citation.');
                // Use the note name as a fallback for basic citation info
                frontMatter = {
                    title: noteName,
                    author: 'Unknown',
                    year: new Date().getFullYear(),
                    publisher: 'Unknown',
                    url: 'Unknown'
                };
            }
            
            this.memoryCopy = JSON.stringify({
                codeBlock: codeBlockContent.trim(),
                frontMatter: frontMatter,
                noteName: noteName
            });

            // Copy code block content to clipboard
            if (codeBlockContent.trim() !== '') {
                navigator.clipboard
                    .writeText(codeBlockContent)
                    .then(() => {
                        new Notice(
                            'Code block copied to clipboard and stored in memory.'
                        );
                    })
                    .catch(() => {
                        new Notice('Failed to copy to clipboard.');
                    });
            } else {
                new Notice('No code block content found.');
            }
        } else {
            new Notice('Cursor is not inside a code block.');
        }
    }

    /**
     * Parses authors from YAML data, handling multiple formats.
     * @param frontMatter The YAML front matter data.
     * @returns A string of authors formatted for citation.
     */
    private parseAuthors(frontMatter: any): string {
        if (frontMatter.author) {
            // Handle if author is an array
            if (Array.isArray(frontMatter.author)) {
                return frontMatter.author.map((author: string) => 
                    // Remove wiki link brackets if present
                    author.replace(/\[\[|\]\]/g, '')
                ).join(', ');
            }
            // Handle if author is a string
            return frontMatter.author.replace(/\[\[|\]\]/g, '');
        } else if (frontMatter.authors && Array.isArray(frontMatter.authors)) {
            return frontMatter.authors.map((author: string) => 
                author.replace(/\[\[|\]\]/g, '')
            ).join(', ');
        }
        return '_author is missing_';
    }

    /**
     * Generates a citation footnote according to the APA style.
     * @param frontMatter The YAML front matter data.
     * @returns Formatted citation string.
     */
    private generateAPACitation(frontMatter: any): string {
        const author = this.parseAuthors(frontMatter);
        const title = frontMatter.title || '[title is missing]';
        // Look for various date fields
        const year = frontMatter.year || 
                    frontMatter.published_year || 
                    frontMatter.published || 
                    frontMatter.date || 
                    'n.d.';
        // Extract just the year if it's a full date
        const yearOnly = typeof year === 'string' ? year.split('-')[0] : year;
        
        const publisher = frontMatter.publisher || '[publisher is missing]';
        const url = frontMatter.url || frontMatter.original_url || '[url is missing]';

        const type = (frontMatter.type || 'WEBSITE').toUpperCase();
        switch (type) {
            case 'BOOK':
                return `${author} (${yearOnly}). *${title}*. ${publisher}.`;
            case 'JOURNAL-ARTICLE':
                return `${author} (${yearOnly}). ${title}. *Journal Title*, Volume(Issue), pages. DOI or URL`;
            case 'VIDEO':
            case 'YOUTUBEVIDEO':
            case 'YOUTUBE-VIDEO':
                return `${author} (${yearOnly}). *${title}* [Video]. ${publisher}. ${url}`;

            case 'WIKIPEDIA-ARTICLE':
            case 'WIKIPEDIA':
            case 'wikipedia':
            case 'wikipedia-article':
                return `${title} (${yearOnly}, Month Day). In _Wikipedia_. ${url}`;
            case 'WEBPAGE':
            case 'WEBSITE':
            case 'SITE':
            case 'WEB':
            case 'ARTICLE':
            case 'NEWSPAPER-ARTICLE':
            case 'newspaper-article':
            case 'article':
                return `${author} (${yearOnly}). ${title}. ${publisher}. ${url}`;
            case 'LLM-SESSION':
                return `${author} (${yearOnly}). *${title}* [Large language model]. ${url}`;
            default:
                return `${author} (${yearOnly}). *${title}*. ${publisher}. ${url}`;
        }
    }

    /**
     * Retrieves the next or existing footnote number by scanning the content.
     * If matching citation is found, uses its number.
     * @param editor The active editor instance.
     * @param citation The citation string to be checked.
     * @returns Number indicating footnote order.
     */
    private getOrAssignFootnoteNumber(editor: Editor, citation: string): number {
        const content = editor.getValue();
        const existingFootnotes: Record<string, number> = {};

        // Match and store existing footnotes
        const footnotePattern = /\[\^(\d+)\]:\s+(.+)/g;
        let match;
        while ((match = footnotePattern.exec(content)) !== null) {
            existingFootnotes[match[2].trim()] = parseInt(match[1]);
        }

        // Return existing footnote number if citation matches
        if (existingFootnotes[citation]) {
            return existingFootnotes[citation];
        }

        // Return the next available footnote number
        const nextNumber = Object.values(existingFootnotes).length > 0
            ? Math.max(...Object.values(existingFootnotes)) + 1
            : 1;

        return nextNumber;
    }

    /**
     * Finds or creates the "Footnotes" section and appends footnotes.
     * Ensures new footnotes are correctly placed or consolidated.
     * @param editor The active editor instance.
     * @param footnoteNumber The footnote order number.
     * @param citation The citation string.
     */
    private appendFootnote(editor: Editor, footnoteNumber: number, citation: string): void {
        let content = editor.getValue();
        const footnotesSection = content.split(/## Footnotes\s+/);

        if (footnotesSection.length > 1) {
            // Append into existing "Footnotes" section if not duplicate
            const footnotesText = footnotesSection[1].trim();
            const existingCitationPattern = new RegExp(
                `\\[\\^${footnoteNumber}\\]:\\s+${citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
            );
            if (!existingCitationPattern.test(footnotesText)) {
                content = content.replace(
                    /## Footnotes\s+([\s\S]*)/,
                    `## Footnotes\n${footnotesText}\n[^${footnoteNumber}]: ${citation}`
                );
            }
        } else {
            // No "Footnotes" section, so create it
            content += `\n\n## Footnotes\n[^${footnoteNumber}]: ${citation}`;
        }

        editor.setValue(content);
    }

    /**
     * Pastes the memory-stored content into the editor as a footnote citation.
     * Ensures proper incrementing and duplicates management for citations.
     * Formats each line of the citation with markdown's quotation format.
     * Appends a line break and a wiki link to the source note.
     * @param editor The active editor instance.
     */
    private pasteFromMemory(editor: Editor): void {
        if (this.memoryCopy) {
            // Save the current cursor position
            const currentCursor = editor.getCursor();
            
            const copyObj = JSON.parse(this.memoryCopy);
            const citation = this.generateAPACitation(copyObj.frontMatter);
            const footnoteNumber = this.getOrAssignFootnoteNumber(editor, citation);

            // Format text as markdown quote for each line
            const quotedContent = (copyObj.selection || copyObj.codeBlock)
                .split('\n')
                .map((line: string) => `> ${line}`)
                .join('\n');

            // Create footnote text with a line break before the wiki link
            const footnoteText = `${quotedContent}.[^${footnoteNumber}]\n\n  - *[[${copyObj.noteName}]]*`;

            // Replace selection with quoted text, followed by a footnote and wiki link
            editor.replaceSelection(footnoteText);

            this.appendFootnote(editor, footnoteNumber, citation);

            // Restore the cursor position
            editor.setCursor(currentCursor);

            new Notice('Pasted content with citation as footnote in quote format.');
        } else {
            new Notice('Memory is empty.');
        }
    }

    /**
     * Loads plugin settings.
     */
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    /**
     * Saves the plugin settings.
     */
    async saveSettings() {
        await this.saveData(this.settings);
    }
}

/**
 * Settings tab for configuring the Copy Code Block Plugin.
 */
class CopyCodeBlockSettingTab extends PluginSettingTab {
    plugin: CopyCodeBlockPlugin;

    constructor(app: App, plugin: CopyCodeBlockPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Displays the settings tab with form elements.
     */
    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Citation Style')
            .setDesc('Choose your preferred citation style.')
            .addDropdown((dropdown) => {
                dropdown
                    .addOption('APA', 'APA (American Psychological Association)')
                    // Additional styles can be added in future
                    .setValue(this.plugin.settings.citationStyle)
                    .onChange(async (value) => {
                        this.plugin.settings.citationStyle = value;
                        await this.plugin.saveSettings();
                    });
            });
    }
}