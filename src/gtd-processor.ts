import Anthropic from '@anthropic-ai/sdk';
import { FlowProject, GTDProcessingResult, ProjectSuggestion } from './types';

export class GTDProcessor {
	private client: Anthropic;
	private availableSpheres: string[];

	constructor(apiKey: string, spheres: string[] = ['personal', 'work']) {
		this.client = new Anthropic({
			apiKey,
			dangerouslyAllowBrowser: true
		});
		this.availableSpheres = spheres;
	}

	/**
	 * Process an inbox item with context from existing Flow projects
	 */
	async processInboxItem(
		item: string,
		existingProjects: FlowProject[]
	): Promise<GTDProcessingResult> {
		const prompt = this.buildProcessingPrompt(item, existingProjects);

		try {
			const response = await this.client.messages.create({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 2000,
				messages: [{ role: 'user', content: prompt }]
			});

			const content = response.content[0];
			if (content.type !== 'text') {
				throw new Error('Unexpected response type from Claude');
			}

			return this.parseResponse(content.text, existingProjects);
		} catch (error) {
			throw new Error(`Failed to process inbox item: ${error.message}`);
		}
	}

	/**
	 * Build the Claude prompt with project context
	 */
	private buildProcessingPrompt(item: string, projects: FlowProject[]): string {
		const projectContext = this.buildProjectContext(projects);
		const spheresContext = this.availableSpheres.length > 0
			? `\n\nThe user organises their work using these spheres: ${this.availableSpheres.join(', ')}.`
			: '';

		return `You are a GTD (Getting Things Done) coach. You must use British English spelling and grammar in all responses. A user has captured this item during their mindsweep:

"${item}"

${projectContext}${spheresContext}

Analyze this item according to GTD principles:

**PROJECT**: A multi-step outcome that requires more than one action to complete. Projects MUST have a clear outcome and a concrete next action.

**NEXT ACTION**: A single, physical, visible action that can be done in one sitting. Must start with an action verb and be completely clear about what to do.

**REFERENCE**: Information to store for later (no action needed).

**SOMEDAY/MAYBE**: Something you might want to do in the future but not now.

Rules:
- If it requires multiple steps → It's a PROJECT. Define the outcome and identify the FIRST next action.
- If it's a single completable action → It's a NEXT ACTION.
- A quality next action must: start with a verb, be specific, be completable in one sitting, include context.
- Projects should be stated as outcomes (e.g., "Website redesign complete" not "Redesign website").
- If this item relates to an existing project, suggest which project(s) it belongs to.
- ALWAYS provide the option to create a new project, even if suggesting existing ones.

Respond with a JSON object in this exact format (DO NOT include any other text or markdown):
{
  "isActionable": true/false,
  "category": "next-action/project/reference/someday",
  "projectOutcome": "the desired outcome (only if project)",
  "nextAction": "the specific next action to take",
  "reasoning": "brief explanation of your analysis",
  "futureActions": ["array of other actions that will be needed (only if project)"],
  "suggestedProjects": [
    {
      "projectTitle": "title of existing project",
      "relevance": "why this project is relevant",
      "confidence": "high/medium/low"
    }
  ],
  "recommendedAction": "create-project/add-to-project/next-actions-file/someday-file/reference/trash",
  "recommendedActionReasoning": "brief explanation of where this should go and why",
  "recommendedSpheres": ["array of recommended spheres from the available list"],
  "recommendedSpheresReasoning": "brief explanation of why these spheres fit this item"
}

Where to route items:
- "create-project": Item needs a new project (multi-step outcome)
- "add-to-project": Item should be added to an existing project (use this if suggestedProjects has high confidence matches)
- "next-actions-file": Standalone next action that doesn't belong to a project
- "someday-file": Something to do someday/maybe, not now
- "reference": Information to store, not actionable
- "trash": Not useful, can be discarded

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
	 * Parse Claude's response into structured result
	 */
	private parseResponse(
		responseText: string,
		existingProjects: FlowProject[]
	): GTDProcessingResult {
		// Strip markdown code blocks if present
		let cleanedText = responseText
			.replace(/```json\n?/g, '')
			.replace(/```\n?/g, '')
			.trim();

		try {
			const parsed = JSON.parse(cleanedText);

			// Map suggested projects to actual project objects
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

			return {
				isActionable: parsed.isActionable,
				category: parsed.category,
				projectOutcome: parsed.projectOutcome,
				nextAction: parsed.nextAction,
				reasoning: parsed.reasoning,
				futureActions: parsed.futureActions || [],
				suggestedProjects,
				recommendedAction: parsed.recommendedAction || 'next-actions-file',
				recommendedActionReasoning: parsed.recommendedActionReasoning || 'No specific recommendation provided',
				recommendedSpheres: parsed.recommendedSpheres || [],
				recommendedSpheresReasoning: parsed.recommendedSpheresReasoning || ''
			};
		} catch (error) {
			throw new Error(`Failed to parse Claude response: ${error.message}\n\nResponse: ${cleanedText}`);
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
			const response = await this.client.messages.create({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 3000,
				messages: [{ role: 'user', content: prompt }]
			});

			const content = response.content[0];
			if (content.type !== 'text') {
				throw new Error('Unexpected response type from Claude');
			}

			const cleanedText = content.text
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
			const response = await this.client.messages.create({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 500,
				messages: [{ role: 'user', content: prompt }]
			});

			const content = response.content[0];
			if (content.type !== 'text') {
				throw new Error('Unexpected response type from Claude');
			}

			return content.text;
		} catch (error) {
			throw new Error(`AI call failed: ${error.message}`);
		}
	}
}
