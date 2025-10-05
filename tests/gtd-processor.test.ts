import { GTDProcessor } from '../src/gtd-processor';
import { FlowProject } from '../src/types';
import Anthropic from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');

describe('GTDProcessor', () => {
	let processor: GTDProcessor;
	let mockClient: jest.Mocked<Anthropic>;
	const mockApiKey = 'test-api-key';

	beforeEach(() => {
		mockClient = {
			messages: {
				create: jest.fn(),
			},
		} as any;

		(Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => mockClient);
		processor = new GTDProcessor(mockApiKey);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('processInboxItem', () => {
		const mockProjects: FlowProject[] = [
			{
				file: 'health.md',
				title: 'Health and Fitness',
				tags: ['project/personal', 'project/health'],
				nextActions: ['Book gym membership'],
				futureNextActions: []
			},
			{
				file: 'website.md',
				title: 'Website Redesign',
				tags: ['project/work'],
				nextActions: ['Meet with designer'],
				futureNextActions: ['Deploy to production']
			}
		];

		it('should process a simple next action', async () => {
			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: JSON.stringify({
						isActionable: true,
						category: 'next-action',
						nextAction: 'Call Dr. Smith at 555-0123 to schedule dental cleaning',
						reasoning: 'This is a single, specific action that can be completed in one call',
						suggestedProjects: []
					})
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			const result = await processor.processInboxItem('call dentist', []);

			expect(result).toMatchObject({
				isActionable: true,
				category: 'next-action',
				nextAction: 'Call Dr. Smith at 555-0123 to schedule dental cleaning',
				suggestedProjects: []
			});

			expect(mockClient.messages.create).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'claude-sonnet-4-20250514',
					max_tokens: 2000
				})
			);
		});

		it('should process a project with outcome and future actions', async () => {
			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: JSON.stringify({
						isActionable: true,
						category: 'project',
						projectOutcome: 'Summer vacation fully planned and booked',
						nextAction: 'Email Sarah to discuss preferred vacation dates',
						reasoning: 'Planning a vacation requires multiple steps',
						futureActions: [
							'Research destinations',
							'Book flights',
							'Reserve accommodation'
						],
						suggestedProjects: []
					})
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			const result = await processor.processInboxItem('plan vacation', []);

			expect(result).toMatchObject({
				isActionable: true,
				category: 'project',
				projectOutcome: 'Summer vacation fully planned and booked',
				nextAction: 'Email Sarah to discuss preferred vacation dates',
				futureActions: expect.arrayContaining([
					'Research destinations',
					'Book flights',
					'Reserve accommodation'
				])
			});
		});

		it('should suggest existing projects when relevant', async () => {
			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: JSON.stringify({
						isActionable: true,
						category: 'next-action',
						nextAction: 'Research and compare gym membership options in my area',
						reasoning: 'This is related to the existing Health and Fitness project',
						suggestedProjects: [
							{
								projectTitle: 'Health and Fitness',
								relevance: 'This action relates to getting started with fitness activities',
								confidence: 'high'
							}
						]
					})
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			const result = await processor.processInboxItem('look into gym memberships', mockProjects);

			expect(result.suggestedProjects).toHaveLength(1);
			expect(result.suggestedProjects![0]).toMatchObject({
				project: expect.objectContaining({
					title: 'Health and Fitness'
				}),
				relevance: 'This action relates to getting started with fitness activities',
				confidence: 'high'
			});
		});

		it('should match projects with fuzzy matching on similar titles', async () => {
			const projectsWithSpecificTitle: FlowProject[] = [
				{
					file: 'office.md',
					title: 'Create a 3-day office counter argument',
					tags: ['project/work'],
					nextActions: ['Draft initial outline'],
					futureNextActions: []
				}
			];

			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: JSON.stringify({
						isActionable: true,
						category: 'next-action',
						nextAction: 'Draft initial outline for 3-day office document',
						reasoning: 'This relates to creating a counter argument document',
						suggestedProjects: [
							{
								projectTitle: '3-day office counter argument',
								relevance: 'This is about creating the same document',
								confidence: 'high'
							}
						]
					})
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			const result = await processor.processInboxItem(
				'Start doc for 3 day in the office counter argument',
				projectsWithSpecificTitle
			);

			expect(result.suggestedProjects).toHaveLength(1);
			expect(result.suggestedProjects![0].project.title).toBe(
				'Create a 3-day office counter argument'
			);
		});

		it('should match projects ignoring punctuation differences', async () => {
			const projectsWithPunctuation: FlowProject[] = [
				{
					file: 'health.md',
					title: 'Health & Fitness Goals',
					tags: ['project/personal'],
					nextActions: [],
					futureNextActions: []
				}
			];

			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: JSON.stringify({
						isActionable: true,
						category: 'next-action',
						nextAction: 'Set fitness goals',
						reasoning: 'Related to health tracking',
						suggestedProjects: [
							{
								projectTitle: 'Health and Fitness Goals',
								relevance: 'Same project, different punctuation',
								confidence: 'high'
							}
						]
					})
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			const result = await processor.processInboxItem('track fitness', projectsWithPunctuation);

			expect(result.suggestedProjects).toHaveLength(1);
			expect(result.suggestedProjects![0].project.title).toBe('Health & Fitness Goals');
		});

		it('should not match projects below similarity threshold', async () => {
			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: JSON.stringify({
						isActionable: true,
						category: 'next-action',
						nextAction: 'Research quantum computing',
						reasoning: 'Not related to existing projects',
						suggestedProjects: [
							{
								projectTitle: 'Completely Unrelated Project Name',
								relevance: 'Not actually related',
								confidence: 'low'
							}
						]
					})
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			const result = await processor.processInboxItem('quantum computing', mockProjects);

			// Should not match because 'Completely Unrelated Project Name'
			// is not similar to 'Health and Fitness' or 'Website Redesign'
			expect(result.suggestedProjects).toHaveLength(0);
		});

		it('should prefer exact matches over fuzzy matches', async () => {
			const projectsWithSimilarTitles: FlowProject[] = [
				{
					file: 'website.md',
					title: 'Website Redesign',
					tags: ['project/work'],
					nextActions: [],
					futureNextActions: []
				},
				{
					file: 'website2.md',
					title: 'Website',
					tags: ['project/work'],
					nextActions: [],
					futureNextActions: []
				}
			];

			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: JSON.stringify({
						isActionable: true,
						category: 'next-action',
						nextAction: 'Update website',
						reasoning: 'Website work',
						suggestedProjects: [
							{
								projectTitle: 'Website',
								relevance: 'Exact match',
								confidence: 'high'
							}
						]
					})
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			const result = await processor.processInboxItem('website work', projectsWithSimilarTitles);

			// Should match the exact title 'Website', not 'Website Redesign'
			expect(result.suggestedProjects).toHaveLength(1);
			expect(result.suggestedProjects![0].project.title).toBe('Website');
		});

		it('should include project context in the prompt', async () => {
			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: JSON.stringify({
						isActionable: true,
						category: 'next-action',
						nextAction: 'Test action',
						reasoning: 'Test',
						suggestedProjects: []
					})
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			await processor.processInboxItem('test item', mockProjects);

			const callArgs = mockClient.messages.create.mock.calls[0][0];
			const prompt = callArgs.messages[0].content;

			expect(prompt).toContain('Health and Fitness');
			expect(prompt).toContain('Website Redesign');
			expect(prompt).toContain('Book gym membership');
		});

		it('should handle reference items', async () => {
			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: JSON.stringify({
						isActionable: false,
						category: 'reference',
						nextAction: 'Store in recipe collection',
						reasoning: 'This is information to keep for later, no action needed',
						suggestedProjects: []
					})
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			const result = await processor.processInboxItem('recipe for lasagna', []);

			expect(result).toMatchObject({
				isActionable: false,
				category: 'reference'
			});
		});

		it('should handle someday/maybe items', async () => {
			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: JSON.stringify({
						isActionable: false,
						category: 'someday',
						nextAction: 'Add to someday/maybe list',
						reasoning: 'Not actionable right now but might be in the future',
						suggestedProjects: []
					})
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			const result = await processor.processInboxItem('learn to play piano', []);

			expect(result).toMatchObject({
				isActionable: false,
				category: 'someday'
			});
		});

		it('should strip markdown code blocks from response', async () => {
			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: '```json\n' + JSON.stringify({
						isActionable: true,
						category: 'next-action',
						nextAction: 'Test action',
						reasoning: 'Test',
						suggestedProjects: []
					}) + '\n```'
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			const result = await processor.processInboxItem('test', []);

			expect(result.nextAction).toBe('Test action');
		});

		it('should throw error on API failure', async () => {
			mockClient.messages.create.mockRejectedValue(new Error('API Error'));

			await expect(
				processor.processInboxItem('test', [])
			).rejects.toThrow('Failed to process inbox item: API Error');
		});

		it('should throw error on invalid JSON response', async () => {
			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: 'Invalid JSON response'
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			await expect(
				processor.processInboxItem('test', [])
			).rejects.toThrow('Failed to parse Claude response');
		});

		it('should handle empty project list', async () => {
			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: JSON.stringify({
						isActionable: true,
						category: 'next-action',
						nextAction: 'Test action',
						reasoning: 'Test',
						suggestedProjects: []
					})
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			await processor.processInboxItem('test item', []);

			const callArgs = mockClient.messages.create.mock.calls[0][0];
			const prompt = callArgs.messages[0].content;

			expect(prompt).toContain('The user currently has no existing projects');
		});

		it('should limit project context to prevent token overflow', async () => {
			// Create 25 projects
			const manyProjects: FlowProject[] = Array.from({ length: 25 }, (_, i) => ({
				file: `project${i}.md`,
				title: `Project ${i}`,
				tags: [`project/test${i}`],
				nextActions: [`Action ${i}`],
				futureNextActions: []
			}));

			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: JSON.stringify({
						isActionable: true,
						category: 'next-action',
						nextAction: 'Test action',
						reasoning: 'Test',
						suggestedProjects: []
					})
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			await processor.processInboxItem('test', manyProjects);

			const callArgs = mockClient.messages.create.mock.calls[0][0];
			const prompt = callArgs.messages[0].content;

			// Should include first 20 projects
			expect(prompt).toContain('Project 0');
			expect(prompt).toContain('Project 19');
			// Should not include projects beyond 20
			expect(prompt).not.toContain('Project 20');
		});
	});

	describe('prioritizeActions', () => {
		it('should prioritize a list of actions', async () => {
			const actions = [
				'Call dentist to schedule appointment',
				'Research vacation destinations',
				'Reply to important client email'
			];

			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: JSON.stringify({
						prioritizedActions: [
							{
								action: 'Reply to important client email',
								priority: 'urgent-important',
								rationale: 'Time-sensitive client communication',
								suggestedOrder: 1
							},
							{
								action: 'Call dentist to schedule appointment',
								priority: 'important-not-urgent',
								rationale: 'Important for health but flexible timing',
								suggestedOrder: 2
							},
							{
								action: 'Research vacation destinations',
								priority: 'neither',
								rationale: 'Can be done when time allows',
								suggestedOrder: 3
							}
						],
						overallGuidance: 'Focus on the client email first as it\'s time-sensitive. Then schedule your dental appointment.'
					})
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			const result = await processor.prioritizeActions(actions);

			expect(result.prioritizedActions).toHaveLength(3);
			expect(result.prioritizedActions[0].priority).toBe('urgent-important');
			expect(result.overallGuidance).toContain('client email');
		});

		it('should handle empty action list', async () => {
			const result = await processor.prioritizeActions([]);

			expect(result).toEqual({
				prioritizedActions: [],
				overallGuidance: ''
			});
		});

		it('should strip markdown from prioritization response', async () => {
			const mockResponse = {
				content: [{
					type: 'text' as const,
					text: '```json\n' + JSON.stringify({
						prioritizedActions: [],
						overallGuidance: 'Test guidance'
					}) + '\n```'
				}]
			};

			mockClient.messages.create.mockResolvedValue(mockResponse as any);

			const result = await processor.prioritizeActions(['test action']);

			expect(result.overallGuidance).toBe('Test guidance');
		});

		it('should throw error on API failure', async () => {
			mockClient.messages.create.mockRejectedValue(new Error('API Error'));

			await expect(
				processor.prioritizeActions(['test'])
			).rejects.toThrow('Failed to prioritize actions: API Error');
		});
	});
});
