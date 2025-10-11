import { LanguageModelClient } from "./language-model";
import {
  FlowProject,
  ProjectReviewResponse,
  ProjectImprovement,
  ProjectMerge,
  ProjectStatusChange,
  NextActionImprovement,
} from "./types";
import { GTDResponseValidationError } from "./errors";

export class ProjectReviewer {
  private client: LanguageModelClient;
  private model: string;

  constructor(client: LanguageModelClient, model: string = "claude-sonnet-4-20250514") {
    this.client = client;
    this.model = model;
  }

  /**
   * Review all projects in a given sphere
   */
  async reviewProjects(projects: FlowProject[], sphere: string): Promise<ProjectReviewResponse> {
    const prompt = this.buildReviewPrompt(projects, sphere);

    try {
      const responseText = await this.client.sendMessage({
        model: this.model,
        maxTokens: 4000,
        messages: [{ role: "user", content: prompt }],
      });

      return this.parseResponse(responseText, projects);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Failed to review projects: ${err.message}`);
    }
  }

  /**
   * Build the review prompt for the LLM
   */
  private buildReviewPrompt(projects: FlowProject[], sphere: string): string {
    const projectSummaries = projects
      .map((p, idx) => {
        const tags = p.tags.join(", ");
        const status = p.status || "live";
        const priority = p.priority || "not set";
        const nextActions =
          p.nextActions.length > 0
            ? p.nextActions.map((a) => `    - ${a}`).join("\n")
            : "    (none)";

        // Extract description from the file content
        // For now, we'll just note it should be reviewed
        return `${idx + 1}. **${p.title}**
   File: ${p.file}
   Tags: ${tags}
   Status: ${status}
   Priority: ${priority}
   Next actions:
${nextActions}`;
      })
      .join("\n\n");

    return `You are a GTD (Getting Things Done) coach reviewing a user's live projects. You must use British English spelling and grammar in all responses.

The user has ${projects.length} live project(s) in their "${sphere}" sphere:

${projectSummaries}

Your task is to review these projects and provide suggestions for improvements. Consider:

**Project Names:**
- Should state the successful outcome (often past tense or completed state)
- Be specific enough to know when it's done
- Avoid vague terms like "Handle", "Deal with", "Sort out"
- Examples:
  - Good: "Kitchen remodelled", "Annual report submitted", "New hire onboarded"
  - Bad: "Kitchen project", "Work on report", "Hiring stuff"

**Project Descriptions:**
- Should clearly state the desired outcome
- Include context and motivation
- Be specific and measurable
- Help the user and AI understand the project

**Next Actions:**
- Must start with an action verb
- Be specific and completable in one sitting
- Include context (who, where, what specifically)
- Be 15-150 characters long
- Avoid vague terms ("something", "maybe", "stuff")
- Examples:
  - Good: "Call Dr. Smith's office at 555-0123 to schedule cleaning"
  - Bad: "dentist"

**Global Review:**
- Spot duplicate or overlapping projects that should be merged
- Identify projects that may be complete, paused, or archived
- Consider if projects are well-organized

Respond with a JSON object in this exact format (DO NOT include any other text or markdown):
{
  "projectsOk": ["file path of projects that look good"],
  "improvements": [
    {
      "projectPath": "file path",
      "currentName": "current project name",
      "suggestedName": "improved name (only if improvement needed, otherwise omit)",
      "currentDescription": "current description from file",
      "suggestedDescription": "improved description (only if improvement needed, otherwise omit)",
      "nextActionImprovements": [
        {
          "current": "current next action text",
          "suggested": "improved next action text"
        }
      ],
      "rationale": "explanation of suggested improvements"
    }
  ],
  "merges": [
    {
      "primaryProject": "file path of project to keep",
      "projectsToMerge": ["file paths of projects to merge into primary"],
      "combinedNextActions": ["all next actions combined and deduplicated"],
      "rationale": "explanation of why these should be merged"
    }
  ],
  "statusChanges": [
    {
      "projectPath": "file path",
      "currentStatus": "current status",
      "suggestedStatus": "complete/archived/paused",
      "rationale": "explanation of suggested status change"
    }
  ]
}

IMPORTANT:
- Only suggest improvements when actually needed
- If a project is perfect, include it in "projectsOk"
- For "improvements", only include fields that need changing (omit suggestedName/suggestedDescription if not needed)
- Be conservative with merges - only suggest when projects are clearly duplicate/overlapping
- For status changes, only suggest when there's clear evidence (no next actions, seems complete, etc.)
- Note: You cannot see the full file contents, so you may need to infer descriptions from titles and next actions`;
  }

  /**
   * Parse the LLM response into structured data
   */
  private parseResponse(responseText: string, projects: FlowProject[]): ProjectReviewResponse {
    // Strip markdown code blocks if present
    let cleanedText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let parsed: unknown;

    try {
      parsed = JSON.parse(cleanedText);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(
        `Failed to parse review response: ${err.message}\n\nResponse: ${cleanedText}`
      );
    }

    this.validateResponse(parsed, cleanedText);

    return parsed as ProjectReviewResponse;
  }

  /**
   * Validate the parsed response structure
   */
  private validateResponse(parsed: any, rawResponse: string): void {
    const withResponse = (message: string): string => {
      return `${message}\n\nRaw model response:\n${rawResponse}`;
    };

    if (typeof parsed !== "object" || parsed === null) {
      throw new GTDResponseValidationError(
        withResponse("Invalid review response: expected an object")
      );
    }

    // Validate projectsOk
    if (!Array.isArray(parsed.projectsOk)) {
      throw new GTDResponseValidationError(
        withResponse('Invalid review response: "projectsOk" must be an array')
      );
    }

    // Validate improvements
    if (!Array.isArray(parsed.improvements)) {
      throw new GTDResponseValidationError(
        withResponse('Invalid review response: "improvements" must be an array')
      );
    }

    for (const [idx, improvement] of parsed.improvements.entries()) {
      if (typeof improvement !== "object" || improvement === null) {
        throw new GTDResponseValidationError(
          withResponse(`Invalid review response: improvements[${idx}] must be an object`)
        );
      }

      if (typeof improvement.projectPath !== "string") {
        throw new GTDResponseValidationError(
          withResponse(`Invalid review response: improvements[${idx}].projectPath must be a string`)
        );
      }

      if (typeof improvement.currentName !== "string") {
        throw new GTDResponseValidationError(
          withResponse(`Invalid review response: improvements[${idx}].currentName must be a string`)
        );
      }

      if (typeof improvement.currentDescription !== "string") {
        throw new GTDResponseValidationError(
          withResponse(
            `Invalid review response: improvements[${idx}].currentDescription must be a string`
          )
        );
      }

      if (typeof improvement.rationale !== "string") {
        throw new GTDResponseValidationError(
          withResponse(`Invalid review response: improvements[${idx}].rationale must be a string`)
        );
      }

      if (
        improvement.nextActionImprovements !== undefined &&
        !Array.isArray(improvement.nextActionImprovements)
      ) {
        throw new GTDResponseValidationError(
          withResponse(
            `Invalid review response: improvements[${idx}].nextActionImprovements must be an array when provided`
          )
        );
      }
    }

    // Validate merges
    if (!Array.isArray(parsed.merges)) {
      throw new GTDResponseValidationError(
        withResponse('Invalid review response: "merges" must be an array')
      );
    }

    for (const [idx, merge] of parsed.merges.entries()) {
      if (typeof merge !== "object" || merge === null) {
        throw new GTDResponseValidationError(
          withResponse(`Invalid review response: merges[${idx}] must be an object`)
        );
      }

      if (typeof merge.primaryProject !== "string") {
        throw new GTDResponseValidationError(
          withResponse(`Invalid review response: merges[${idx}].primaryProject must be a string`)
        );
      }

      if (!Array.isArray(merge.projectsToMerge)) {
        throw new GTDResponseValidationError(
          withResponse(`Invalid review response: merges[${idx}].projectsToMerge must be an array`)
        );
      }

      if (!Array.isArray(merge.combinedNextActions)) {
        throw new GTDResponseValidationError(
          withResponse(
            `Invalid review response: merges[${idx}].combinedNextActions must be an array`
          )
        );
      }

      if (typeof merge.rationale !== "string") {
        throw new GTDResponseValidationError(
          withResponse(`Invalid review response: merges[${idx}].rationale must be a string`)
        );
      }
    }

    // Validate statusChanges
    if (!Array.isArray(parsed.statusChanges)) {
      throw new GTDResponseValidationError(
        withResponse('Invalid review response: "statusChanges" must be an array')
      );
    }

    for (const [idx, change] of parsed.statusChanges.entries()) {
      if (typeof change !== "object" || change === null) {
        throw new GTDResponseValidationError(
          withResponse(`Invalid review response: statusChanges[${idx}] must be an object`)
        );
      }

      if (typeof change.projectPath !== "string") {
        throw new GTDResponseValidationError(
          withResponse(
            `Invalid review response: statusChanges[${idx}].projectPath must be a string`
          )
        );
      }

      if (typeof change.currentStatus !== "string") {
        throw new GTDResponseValidationError(
          withResponse(
            `Invalid review response: statusChanges[${idx}].currentStatus must be a string`
          )
        );
      }

      const validStatuses = new Set(["complete", "archived", "paused"]);
      if (!validStatuses.has(change.suggestedStatus)) {
        throw new GTDResponseValidationError(
          withResponse(
            `Invalid review response: statusChanges[${idx}].suggestedStatus must be one of complete/archived/paused`
          )
        );
      }

      if (typeof change.rationale !== "string") {
        throw new GTDResponseValidationError(
          withResponse(`Invalid review response: statusChanges[${idx}].rationale must be a string`)
        );
      }
    }
  }
}
