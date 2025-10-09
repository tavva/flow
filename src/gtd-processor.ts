import { LanguageModelClient } from './language-model';
import { FlowProject, GTDProcessingResult, ProjectSuggestion, PersonNote, PersonSuggestion } from './types';
import { GTDResponseValidationError } from './errors';

export class GTDProcessor {
        private client: LanguageModelClient;
        private availableSpheres: string[];
        private model: string;

        constructor(
                client: LanguageModelClient,
                spheres: string[] = ['personal', 'work'],
                model: string = 'claude-sonnet-4-20250514'
        ) {
                this.client = client;
                this.availableSpheres = spheres;
                this.model = model;
        }

	/**
	 * Process an inbox item with context from existing Flow projects and person notes
	 */
	async processInboxItem(
		item: string,
		existingProjects: FlowProject[],
		existingPersons: PersonNote[] = []
	): Promise<GTDProcessingResult> {
		const prompt = this.buildProcessingPrompt(item, existingProjects, existingPersons);

		try {
                        const responseText = await this.client.sendMessage({
                                model: this.model,
                                maxTokens: 2000,
                                messages: [{ role: 'user', content: prompt }]
                        });

                        return this.parseResponse(responseText, existingProjects, existingPersons);
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			throw new Error(`Failed to process inbox item: ${err.message}`);
		}
	}

	/**
	 * Build the model prompt with project and person context
	 */
	private buildProcessingPrompt(item: string, projects: FlowProject[], persons: PersonNote[] = []): string {
		const projectContext = this.buildProjectContext(projects);
		const personContext = this.buildPersonContext(persons);
		const spheresContext = this.availableSpheres.length > 0
			? `\n\nThe user organises their work using these spheres: ${this.availableSpheres.join(', ')}.`
			: '';

		return `You are a GTD (Getting Things Done) coach. You must use British English spelling and grammar in all responses. A user has captured this item in their inbox:

"${item}"

${projectContext}${personContext}${spheresContext}

Analyze this item according to GTD principles:

**PROJECT**: A multi-step outcome that requires more than one action to complete. Projects MUST have a clear outcome and a concrete next action.

**NEXT ACTION**: A single, physical, visible action that can be done in one sitting. Must start with an action verb and be completely clear about what to do.

**REFERENCE**: Information to store for later (no action needed). Reference items must be added to an existing project for context.

**PERSON**: Something to discuss with a specific person. This should be added to the person's "## Discuss next" section.

**SOMEDAY/MAYBE**: Something you might want to do in the future but not now.

Rules:
- If it requires multiple steps → It's a PROJECT. Define the outcome and identify the FIRST next action.
- If it's a single completable action → It's a NEXT ACTION.
- If it's something to discuss with a specific person → It's a PERSON item.
- A quality next action must: start with a verb, be specific, be completable in one sitting, include context.
- Projects should be stated as outcomes (e.g., "Website redesign complete" not "Redesign website").
- If this item relates to an existing project, suggest which project(s) it belongs to.
- If this item relates to a specific person, suggest which person note(s) it belongs to.
- ALWAYS provide the option to create a new project, even if suggesting existing ones.
- If a complex item could be broken into multiple discrete next actions (not requiring dependencies), you may provide multiple next actions in the "nextActions" array.
- Focus only on immediate next actions. Do not list future or dependent actions—only include actions that can be started now. If helpful, provide multiple independent next actions in the "nextActions" array.
- For reference items, suggest which existing project(s) should contain this reference and provide the content that should be added.

Respond with a JSON object in this exact format (DO NOT include any other text or markdown):
{
  "isActionable": true/false,
  "category": "next-action/project/reference/person/someday",
  "projectOutcome": "the desired outcome (only if project)",
  "nextAction": "the primary/first next action to take",
  "nextActions": ["optional array of multiple discrete next actions if the item can be broken down into independent actions"],
  "reasoning": "brief explanation of your analysis",
  "suggestedProjects": [
    {
      "projectTitle": "title of existing project",
      "relevance": "why this project is relevant",
      "confidence": "high/medium/low"
    }
  ],
  "suggestedPersons": [
    {
      "personName": "name of existing person",
      "relevance": "why this person is relevant",
      "confidence": "high/medium/low"
    }
  ],
"recommendedAction": "create-project/add-to-project/next-actions-file/someday-file/reference/person/trash/discard",
  "recommendedActionReasoning": "brief explanation of where this should go and why",
  "recommendedSpheres": ["array of recommended spheres from the available list"],
  "recommendedSpheresReasoning": "brief explanation of why these spheres fit this item",
  "referenceContent": "formatted content to add to project (only if reference)"
}

Where to route items:
- "create-project": Item needs a new project (multi-step outcome)
- "add-to-project": Item should be added to an existing project (use this if suggestedProjects has high confidence matches)
- "next-actions-file": Standalone next action that doesn't belong to a project
- "someday-file": Something to do someday/maybe, not now
- "reference": Information to store in an existing project, not actionable
- "person": Something to discuss with a specific person (use this if suggestedPersons has high confidence matches)
- "trash": Not useful, remove from inbox
- "discard": Drop this item from processing without saving it elsewhere

For spheres: Recommend one or more spheres that best categorise this item. Consider the item's content and context.

Examples:
- "plan vacation" → PROJECT: "Summer vacation planned", next action: "Email Sarah to discuss vacation dates"
- "call dentist" → NEXT ACTION: "Call Dr. Smith's office at 555-0123 to schedule cleaning"
- "recipe for lasagna" → REFERENCE: Store in recipe collection`;
	}

	/**
	 * Build context description of existing projects
	 */
	private buildProjectContext(projects: FlowProject[]): string {
		if (projects.length === 0) {
			return 'The user currently has no existing projects.';
		}

		const projectSummaries = projects
			.slice(0, 20) // Limit to prevent token overflow
			.map(p => {
				const tags = p.tags.join(', ');
				const nextActions = p.nextActions.length > 0
					? `Current next actions: ${p.nextActions.slice(0, 2).join('; ')}`
					: 'No next actions defined';
				return `- "${p.title}" [${tags}] - ${nextActions}`;
			})
			.join('\n');

		return `The user has the following existing projects in their Flow system:\n\n${projectSummaries}\n\nConsider if this inbox item relates to any of these projects. If it does, suggest the relevant project(s).`;
	}

	/**
	 * Build context description of existing person notes
	 */
	private buildPersonContext(persons: PersonNote[]): string {
		if (persons.length === 0) {
			return '';
		}

		const personSummaries = persons
			.slice(0, 20) // Limit to prevent token overflow
			.map(p => {
				const tags = p.tags.filter(tag => tag !== 'person').join(', ');
				const tagsDisplay = tags ? ` [${tags}]` : '';
				return `- "${p.title}"${tagsDisplay}`;
			})
			.join('\n');

		return `\n\nThe user has the following person notes:\n\n${personSummaries}\n\nConsider if this inbox item relates to discussing something with any of these people. If it does, suggest the relevant person(s).`;
	}

	/**
	 * Normalize a string for comparison by removing punctuation,
	 * extra whitespace, and converting to lowercase
	 */
	private normalizeForMatching(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
			.replace(/\s+/g, ' ')      // Normalize whitespace
			.trim();
	}

	/**
	 * Calculate similarity between two strings using Dice coefficient
	 * Returns a score between 0 (no similarity) and 1 (identical)
	 */
	private calculateSimilarity(str1: string, str2: string): number {
		const normalized1 = this.normalizeForMatching(str1);
		const normalized2 = this.normalizeForMatching(str2);

		// Exact match after normalization
		if (normalized1 === normalized2) return 1;

		// Bigram-based Dice coefficient
		const bigrams1 = this.getBigrams(normalized1);
		const bigrams2 = this.getBigrams(normalized2);

		if (bigrams1.size === 0 && bigrams2.size === 0) return 1;
		if (bigrams1.size === 0 || bigrams2.size === 0) return 0;

		const intersection = new Set(
			[...bigrams1].filter(x => bigrams2.has(x))
		);

		return (2 * intersection.size) / (bigrams1.size + bigrams2.size);
	}

	/**
	 * Get bigrams (pairs of consecutive characters) from a string
	 */
	private getBigrams(str: string): Set<string> {
		const bigrams = new Set<string>();
		for (let i = 0; i < str.length - 1; i++) {
			bigrams.add(str.substring(i, i + 2));
		}
		return bigrams;
	}

	/**
	 * Find the best matching project using fuzzy matching
	 */
	private findMatchingProject(
		suggestedTitle: string,
		existingProjects: FlowProject[]
	): FlowProject | null {
		// First try exact match (case-insensitive)
		const exactMatch = existingProjects.find(
			p => p.title.toLowerCase() === suggestedTitle.toLowerCase()
		);
		if (exactMatch) return exactMatch;

		// Try fuzzy matching with similarity threshold
		const SIMILARITY_THRESHOLD = 0.6; // 60% similarity required
		let bestMatch: FlowProject | null = null;
		let bestScore = 0;

		for (const project of existingProjects) {
			const similarity = this.calculateSimilarity(
				suggestedTitle,
				project.title
			);

			if (similarity > bestScore && similarity >= SIMILARITY_THRESHOLD) {
				bestScore = similarity;
				bestMatch = project;
			}
		}

		return bestMatch;
	}

	/**
	 * Find the best matching person using fuzzy matching
	 */
	private findMatchingPerson(
		suggestedName: string,
		existingPersons: PersonNote[]
	): PersonNote | null {
		// First try exact match (case-insensitive)
		const exactMatch = existingPersons.find(
			p => p.title.toLowerCase() === suggestedName.toLowerCase()
		);
		if (exactMatch) return exactMatch;

		// Try fuzzy matching with similarity threshold
		const SIMILARITY_THRESHOLD = 0.6; // 60% similarity required
		let bestMatch: PersonNote | null = null;
		let bestScore = 0;

		for (const person of existingPersons) {
			const similarity = this.calculateSimilarity(
				suggestedName,
				person.title
			);

			if (similarity > bestScore && similarity >= SIMILARITY_THRESHOLD) {
				bestScore = similarity;
				bestMatch = person;
			}
		}

		return bestMatch;
	}

	/**
	 * Parse model's response into structured result
	 */
        private parseResponse(
                responseText: string,
                existingProjects: FlowProject[],
                existingPersons: PersonNote[] = []
        ): GTDProcessingResult {
                // Strip markdown code blocks if present
                let cleanedText = responseText
                        .replace(/```json\n?/g, '')
                        .replace(/```\n?/g, '')
                        .trim();

                let parsed: unknown;

                try {
                        parsed = JSON.parse(cleanedText);
                } catch (error) {
                        throw new Error(`Failed to parse model response: ${error.message}\n\nResponse: ${cleanedText}`);
                }

                this.validateParsedResponse(parsed);

                const suggestedProjects: ProjectSuggestion[] = [];
                if (parsed.suggestedProjects && Array.isArray(parsed.suggestedProjects)) {
                        for (const suggestion of parsed.suggestedProjects) {
                                const project = this.findMatchingProject(
                                        suggestion.projectTitle,
                                        existingProjects
                                );
                                if (project) {
                                        suggestedProjects.push({
                                                project,
                                                relevance: suggestion.relevance,
                                                confidence: suggestion.confidence
                                        });
                                }
                        }
                }

                const suggestedPersons: PersonSuggestion[] = [];
                if (parsed.suggestedPersons && Array.isArray(parsed.suggestedPersons)) {
                        for (const suggestion of parsed.suggestedPersons) {
                                const person = this.findMatchingPerson(
                                        suggestion.personName,
                                        existingPersons
                                );
                                if (person) {
                                        suggestedPersons.push({
                                                person,
                                                relevance: suggestion.relevance,
                                                confidence: suggestion.confidence
                                        });
                                }
                        }
                }

                const primaryNextAction =
                        typeof parsed.nextAction === 'string' && parsed.nextAction.trim().length > 0
                                ? parsed.nextAction
                                : Array.isArray(parsed.nextActions) && parsed.nextActions.length > 0
                                        ? parsed.nextActions[0]
                                        : undefined;

                return {
                        isActionable: parsed.isActionable,
                        category: parsed.category,
                        projectOutcome: parsed.projectOutcome,
                        nextAction: primaryNextAction ?? '',
                        nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions : [],
                        reasoning: parsed.reasoning,
suggestedProjects,
                        suggestedPersons,
                        recommendedAction: parsed.recommendedAction || (parsed.isActionable ? 'next-actions-file' : 'reference'),
                        recommendedActionReasoning: parsed.recommendedActionReasoning || 'No specific recommendation provided',
                        recommendedSpheres: Array.isArray(parsed.recommendedSpheres) ? parsed.recommendedSpheres : [],
                        recommendedSpheresReasoning: parsed.recommendedSpheresReasoning || '',
                        referenceContent: parsed.referenceContent
                };
        }

        private validateParsedResponse(parsed: any): asserts parsed is {
                isActionable: boolean;
                category: 'next-action' | 'project' | 'reference' | 'person' | 'someday';
                projectOutcome?: string;
                nextAction?: string;
                nextActions?: string[];
                reasoning: string;
suggestedProjects?: Array<{
                        projectTitle: string;
                        relevance: string;
                        confidence: 'high' | 'medium' | 'low';
                }>;
                suggestedPersons?: Array<{
                        personName: string;
                        relevance: string;
                        confidence: 'high' | 'medium' | 'low';
                }>;
			recommendedAction?:
				| 'create-project'
				| 'add-to-project'
				| 'next-actions-file'
				| 'someday-file'
				| 'reference'
				| 'person'
				| 'trash'
				| 'discard';
                recommendedActionReasoning?: string;
                recommendedSpheres?: string[];
                recommendedSpheresReasoning?: string;
                referenceContent?: string;
        } {
                if (typeof parsed !== 'object' || parsed === null) {
                        throw new GTDResponseValidationError('Invalid model response: expected an object');
                }

                if (typeof parsed.isActionable !== 'boolean') {
                        throw new GTDResponseValidationError('Invalid model response: missing or invalid "isActionable" (expected boolean)');
                }

                const validCategories = new Set(['next-action', 'project', 'reference', 'person', 'someday']);
                if (typeof parsed.category !== 'string' || !validCategories.has(parsed.category)) {
                        throw new GTDResponseValidationError('Invalid model response: missing or invalid "category" (expected one of next-action/project/reference/person/someday)');
                }

                let hasValidNextActions = false;
                if (parsed.nextActions !== undefined && parsed.nextActions !== null) {
                        if (!Array.isArray(parsed.nextActions)) {
                                throw new GTDResponseValidationError(`Invalid model response: "nextActions" must be an array when provided, got ${typeof parsed.nextActions}: ${JSON.stringify(parsed.nextActions)}`);
                        }
                        if (!parsed.nextActions.every((action: unknown) => typeof action === 'string' && action.trim().length > 0)) {
                                throw new GTDResponseValidationError(`Invalid model response: "nextActions" must be an array of non-empty strings when provided, got: ${JSON.stringify(parsed.nextActions)}`);
                        }
                        hasValidNextActions = parsed.nextActions.length > 0;
                }

                const nextActionValue = parsed.nextAction;

                if (parsed.isActionable) {
                        if (typeof nextActionValue === 'string') {
                                if (nextActionValue.trim().length === 0) {
                                        throw new GTDResponseValidationError('Invalid model response: "nextAction" must be a non-empty string for actionable items');
                                }
                        } else {
                                if (nextActionValue !== undefined && nextActionValue !== null) {
                                        throw new GTDResponseValidationError('Invalid model response: "nextAction" must be a string when provided');
                                }

                                if (!hasValidNextActions) {
                                        throw new GTDResponseValidationError('Invalid model response: actionable items must include a non-empty "nextAction" string or a "nextActions" array of non-empty strings');
                                }
                        }
                } else {
                        // For non-actionable items, nextAction can be undefined or empty
                        if (nextActionValue !== undefined && nextActionValue !== null && typeof nextActionValue !== 'string') {
                                throw new GTDResponseValidationError('Invalid model response: "nextAction" must be a string when provided');
                        }
                }

                if (typeof parsed.reasoning !== 'string' || parsed.reasoning.trim().length === 0) {
                        throw new GTDResponseValidationError('Invalid model response: missing or invalid "reasoning" (expected non-empty string)');
                }

                if (parsed.category === 'project') {
                        if (typeof parsed.projectOutcome !== 'string' || parsed.projectOutcome.trim().length === 0) {
                                throw new GTDResponseValidationError('Invalid model response: "projectOutcome" must be provided for project items');
                        }
                }

                if (parsed.suggestedProjects !== undefined) {
                        if (!Array.isArray(parsed.suggestedProjects)) {
                                throw new GTDResponseValidationError('Invalid model response: "suggestedProjects" must be an array when provided');
                        }

                        for (const [index, suggestion] of parsed.suggestedProjects.entries()) {
                                if (
                                        typeof suggestion !== 'object' ||
                                        suggestion === null ||
                                        typeof suggestion.projectTitle !== 'string' ||
                                        typeof suggestion.relevance !== 'string' ||
                                        typeof suggestion.confidence !== 'string'
                                ) {
                                        throw new GTDResponseValidationError(`Invalid model response: suggestedProjects[${index}] must include string "projectTitle", "relevance", and "confidence"`);
                                }

                                const validConfidence = new Set(['high', 'medium', 'low']);
                                if (!validConfidence.has(suggestion.confidence)) {
                                        throw new GTDResponseValidationError(`Invalid model response: suggestedProjects[${index}].confidence must be one of high/medium/low`);
                                }
                        }
                }

                if (parsed.suggestedPersons !== undefined) {
                        if (!Array.isArray(parsed.suggestedPersons)) {
                                throw new GTDResponseValidationError('Invalid model response: "suggestedPersons" must be an array when provided');
                        }

                        for (const [index, suggestion] of parsed.suggestedPersons.entries()) {
                                if (
                                        typeof suggestion !== 'object' ||
                                        suggestion === null ||
                                        typeof suggestion.personName !== 'string' ||
                                        typeof suggestion.relevance !== 'string' ||
                                        typeof suggestion.confidence !== 'string'
                                ) {
                                        throw new GTDResponseValidationError(`Invalid model response: suggestedPersons[${index}] must include string "personName", "relevance", and "confidence"`);
                                }

                                const validConfidence = new Set(['high', 'medium', 'low']);
                                if (!validConfidence.has(suggestion.confidence)) {
                                        throw new GTDResponseValidationError(`Invalid model response: suggestedPersons[${index}].confidence must be one of high/medium/low`);
                                }
                        }
                }

			const validRecommendedActions = new Set([
				'create-project',
				'add-to-project',
				'next-actions-file',
				'someday-file',
				'reference',
				'person',
				'trash',
				'discard'
			]);

			if (parsed.recommendedAction !== undefined) {
				if (typeof parsed.recommendedAction !== 'string' || !validRecommendedActions.has(parsed.recommendedAction)) {
					throw new GTDResponseValidationError('Invalid model response: "recommendedAction" must be one of create-project/add-to-project/next-actions-file/someday-file/reference/person/trash/discard');
				}
			}

                if (parsed.recommendedActionReasoning !== undefined) {
                        if (typeof parsed.recommendedActionReasoning !== 'string' || parsed.recommendedActionReasoning.trim().length === 0) {
                                throw new GTDResponseValidationError('Invalid model response: "recommendedActionReasoning" must be a non-empty string when provided');
                        }
                }

                if (parsed.recommendedAction && parsed.recommendedAction === 'create-project') {
                        if (typeof parsed.projectOutcome !== 'string' || parsed.projectOutcome.trim().length === 0) {
                                throw new GTDResponseValidationError('Invalid model response: "projectOutcome" must accompany a "create-project" recommendation');
                        }
                }

                if (parsed.recommendedSpheres !== undefined && parsed.recommendedSpheres !== null) {
                        if (!Array.isArray(parsed.recommendedSpheres)) {
                                throw new GTDResponseValidationError(`Invalid model response: "recommendedSpheres" must be an array when provided, got ${typeof parsed.recommendedSpheres}: ${JSON.stringify(parsed.recommendedSpheres)}`);
                        }
                        if (!parsed.recommendedSpheres.every((sphere: unknown) => typeof sphere === 'string' && sphere.trim().length > 0)) {
                                throw new GTDResponseValidationError(`Invalid model response: "recommendedSpheres" must be an array of non-empty strings when provided, got: ${JSON.stringify(parsed.recommendedSpheres)}`);
                        }
                }

                if (parsed.recommendedSpheresReasoning !== undefined) {
                        if (typeof parsed.recommendedSpheresReasoning !== 'string') {
                                throw new GTDResponseValidationError('Invalid model response: "recommendedSpheresReasoning" must be a string when provided');
                        }
                }

                if (parsed.referenceContent === null) {
                        parsed.referenceContent = undefined;
                } else if (parsed.referenceContent !== undefined) {
                        if (typeof parsed.referenceContent !== 'string') {
                                throw new GTDResponseValidationError('Invalid model response: "referenceContent" must be a string when provided');
                        }
                }
        }

	/**
	 * Prioritize a list of next actions using Eisenhower Matrix
	 */
	async prioritizeActions(actions: string[]): Promise<any> {
		if (actions.length === 0) {
			return { prioritizedActions: [], overallGuidance: '' };
		}

		const prompt = `You are a GTD coach helping someone prioritise their next actions. You must use British English spelling and grammar in all responses. Here are their actionable items:

${actions.map((action, i) => `${i + 1}. ${action}`).join('\n')}

Analyze these next actions and provide prioritization guidance using the Eisenhower Matrix (Urgent/Important).

Respond with a JSON object in this exact format (DO NOT include any other text or markdown):

{
  "prioritizedActions": [
    {
      "action": "the action text",
      "priority": "urgent-important/important-not-urgent/urgent-not-important/neither",
      "rationale": "brief explanation",
      "suggestedOrder": 1
    }
  ],
  "overallGuidance": "2-3 sentences of coaching on what to focus on first"
}

Sort by suggestedOrder (1 being highest priority).`;

                try {
                        const responseText = await this.client.sendMessage({
                                model: this.model,
                                maxTokens: 3000,
                                messages: [{ role: 'user', content: prompt }]
                        });

                        const cleanedText = responseText
                                .replace(/```json\n?/g, '')
                                .replace(/```\n?/g, '')
                                .trim();

                        return JSON.parse(cleanedText);
		} catch (error) {
			throw new Error(`Failed to prioritize actions: ${error.message}`);
		}
	}

	/**
	 * Make a simple AI call with a prompt and get text response
	 */
	async callAI(prompt: string): Promise<string> {
                try {
                        const responseText = await this.client.sendMessage({
                                model: this.model,
                                maxTokens: 500,
                                messages: [{ role: 'user', content: prompt }]
                        });

                        return responseText;
                } catch (error) {
                        throw new Error(`AI call failed: ${error.message}`);
                }
        }
}
