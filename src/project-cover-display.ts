// ABOUTME: Displays cover images for Flow projects as floating top-right squares
// ABOUTME: Monitors file opens and metadata changes to inject/update cover images in markdown views

import { App, MarkdownView, TFile } from "obsidian";
import { PluginSettings } from "./types";
import { getFrontmatterString, getFrontmatterTags } from "./frontmatter";

const COVER_IMAGE_CLASS = "flow-project-cover-image-float";
const COVER_IMAGE_CONTAINER_CLASS = "flow-project-cover-container";

export class ProjectCoverDisplay {
  private app: App;
  private getSettings: () => PluginSettings;

  constructor(app: App, getSettings: () => PluginSettings) {
    this.app = app;
    this.getSettings = getSettings;
  }

  /**
   * Process a file to check if it should display a cover image
   */
  async processFile(file: TFile | null, view?: MarkdownView): Promise<void> {
    const activeView = view || this.getActiveView();

    if (!file || !activeView) {
      return;
    }

    // Check if cover image display is enabled
    const settings = this.getSettings();
    if (!settings.displayCoverImages) {
      this.removeCoverImage(activeView);
      return;
    }

    // Get metadata from cache
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;

    if (!frontmatter) {
      this.removeCoverImage(activeView);
      return;
    }

    // Check if this is a project file
    const isProject = getFrontmatterTags(frontmatter).some((tag) => tag.includes("project/"));

    if (!isProject) {
      this.removeCoverImage(activeView);
      return;
    }

    // Check for cover-image property
    const coverImage = getFrontmatterString(frontmatter, "cover-image");

    if (!coverImage) {
      this.removeCoverImage(activeView);
      return;
    }

    // Render the cover image
    await this.renderCoverImage(activeView, coverImage);
  }

  /**
   * Render the cover image in the markdown view
   */
  private async renderCoverImage(view: MarkdownView, coverImagePath: string): Promise<void> {
    const container = view.contentEl;

    if (!container) {
      return;
    }

    // Find the content element to position relative to
    const contentEl = container.querySelector(
      ".markdown-preview-view, .cm-scroller"
    ) as HTMLElement;

    if (!contentEl) {
      return;
    }

    // Check if cover image already exists (look inside contentEl)
    let coverContainer = contentEl.querySelector(`.${COVER_IMAGE_CONTAINER_CLASS}`) as HTMLElement;

    // Get the resource path for the image
    const vault = this.app.vault;
    const imageFile = vault.getAbstractFileByPath(coverImagePath);

    if (!imageFile || !(imageFile instanceof TFile)) {
      // Image file doesn't exist, remove any existing cover
      this.removeCoverImage(view);
      return;
    }

    const imageUrl = this.app.vault.getResourcePath(imageFile);

    if (!coverContainer) {
      // Create new cover image container
      // Insert at the beginning of the scrolling content area
      // The CSS float: right will handle positioning
      coverContainer = contentEl.createDiv({ cls: COVER_IMAGE_CONTAINER_CLASS, prepend: true });
      coverContainer.createEl("img", {
        cls: COVER_IMAGE_CLASS,
        attr: { src: imageUrl, alt: "Project cover image" },
      });
    } else {
      // Update existing image
      const img = coverContainer.querySelector(`.${COVER_IMAGE_CLASS}`) as HTMLImageElement;
      if (img && img.src !== imageUrl) {
        img.src = imageUrl;
      }
    }
  }

  /**
   * Remove cover image from the view
   */
  private removeCoverImage(view: MarkdownView): void {
    const container = view.contentEl;

    if (!container) {
      return;
    }

    // Look for cover in the scrolling content area
    const contentEl = container.querySelector(
      ".markdown-preview-view, .cm-scroller"
    ) as HTMLElement;

    if (!contentEl) {
      return;
    }

    const coverContainer = contentEl.querySelector(`.${COVER_IMAGE_CONTAINER_CLASS}`);

    if (coverContainer) {
      coverContainer.remove();
    }
  }

  /**
   * Process all open markdown views
   */
  async processAllViews(): Promise<void> {
    const pendingUpdates: Promise<void>[] = [];

    this.app.workspace.iterateRootLeaves((leaf) => {
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        pendingUpdates.push(this.processFile(view.file, view));
      }
    });

    await Promise.all(pendingUpdates);
  }

  /**
   * Get the active markdown view
   */
  private getActiveView(): MarkdownView | null {
    return this.app.workspace.getActiveViewOfType(MarkdownView);
  }

  /**
   * Clean up all cover images
   */
  destroy(): void {
    // Remove all cover images from all views
    this.app.workspace.iterateRootLeaves((leaf) => {
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        this.removeCoverImage(view);
      }
    });
  }
}
