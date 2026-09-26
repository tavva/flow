import { App, TFile, CachedMetadata } from "obsidian";
import { PersonNote } from "./types";
import { getFrontmatterString, getFrontmatterTags } from "./frontmatter";

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

    const frontmatter = metadata.frontmatter;

    return {
      file: file.path,
      title: file.basename,
      tags: getFrontmatterTags(frontmatter),
      status: getFrontmatterString(frontmatter, "status"),
      creationDate: getFrontmatterString(frontmatter, "creation-date"),
    };
  }

  /**
   * Checks if a file is a person note (has 'person' tag)
   */
  private isPersonNote(metadata: CachedMetadata): boolean {
    return getFrontmatterTags(metadata.frontmatter).includes("person");
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
