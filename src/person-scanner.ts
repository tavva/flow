import { App, TFile, CachedMetadata } from "obsidian";
import { PersonNote } from "./types";

export class PersonScanner {
  constructor(private app: App) {}

  /**
   * Scans the vault for all person notes (files with 'person' tag)
   */
  async scanPersons(): Promise<PersonNote[]> {
    const persons: PersonNote[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const person = await this.parsePersonFile(file);
      if (person) {
        persons.push(person);
      }
    }

    return persons;
  }

  /**
   * Parses a single file to extract person note information
   */
  async parsePersonFile(file: TFile): Promise<PersonNote | null> {
    const metadata = this.app.metadataCache.getFileCache(file);

    if (!metadata || !this.isPersonNote(metadata)) {
      return null;
    }

    const frontmatter = metadata.frontmatter || {};

    return {
      file: file.path,
      title: file.basename,
      tags: this.extractTags(frontmatter.tags),
      status: frontmatter.status,
      creationDate: frontmatter["creation-date"],
    };
  }

  /**
   * Checks if a file is a person note (has 'person' tag)
   */
  private isPersonNote(metadata: CachedMetadata): boolean {
    const frontmatter = metadata.frontmatter;
    if (!frontmatter || !frontmatter.tags) {
      return false;
    }

    const tags = this.normalizeTags(frontmatter.tags);
    return tags.includes("person");
  }

  /**
   * Normalizes tags to array format
   */
  private normalizeTags(tags: string | string[]): string[] {
    if (Array.isArray(tags)) {
      return tags.filter((tag) => typeof tag === "string");
    }
    if (typeof tags === "string") {
      return [tags];
    }
    return [];
  }

  /**
   * Extracts all tags from frontmatter
   */
  private extractTags(tags: string | string[]): string[] {
    return this.normalizeTags(tags);
  }

  /**
   * Searches for person notes by keyword
   */
  searchPersons(persons: PersonNote[], query: string): PersonNote[] {
    const lowerQuery = query.toLowerCase();
    return persons.filter(
      (person) =>
        person.title.toLowerCase().includes(lowerQuery) ||
        person.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Checks if a person note has a "## Discuss next" section
   */
  async hasDiscussNextSection(person: PersonNote): Promise<boolean> {
    try {
      const file = this.app.vault.getAbstractFileByPath(person.file);
      if (!(file instanceof TFile)) {
        return false;
      }

      const content = await this.app.vault.read(file);
      return content.includes("## Discuss next");
    } catch (error) {
      console.warn(`Failed to read person file ${person.file}:`, error);
      return false;
    }
  }
}
