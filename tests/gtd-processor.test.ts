import { GTDProcessor } from '../src/gtd-processor';
import { FlowProject } from '../src/types';
import { LanguageModelClient } from '../src/language-model';

describe('GTDProcessor', () => {
	let processor: GTDProcessor;
        let mockClient: jest.Mocked<LanguageModelClient>;
        const mockModel = 'claude-test-model';

	type MockClaudeResponse = {
		isActionable: boolean;
		category: 'next-action' | 'project' | 'reference' | 'someday';
		projectOutcome?: string;
		nextAction: string;
		nextActions?: string[];
		reasoning: string;
		futureActions?: string[];
		suggestedProjects?: Array<{
			projectTitle: string;
			relevance: string;
			confidence: 'high' | 'medium' | 'low';
		}>;
		recommendedAction?:
			| 'create-project'
			| 'add-to-project'
			| 'next-actions-file'
			| 'someday-file'
			| 'reference'
			| 'trash';
		recommendedActionReasoning?: string;
		recommendedSpheres?: string[];
		recommendedSpheresReasoning?: string;
		referenceContent?: string | null;
	};

	const buildClaudeResponse = (overrides: Partial<MockClaudeResponse> = {}): string =>
		JSON.stringify({
			isActionable: true,
			category: 'next-action',
			nextAction: 'Default next action',
			nextActions: [],
			reasoning: 'Default reasoning',
			futureActions: [],
			suggestedProjects: [],
			recommendedAction: 'next-actions-file',
			recommendedActionReasoning: 'Default recommended action reasoning',
			recommendedSpheres: [],
			recommendedSpheresReasoning: '',
			...overrides
		});

        beforeEach(() => {
                mockClient = {
                        sendMessage: jest.fn(),
                } as jest.Mocked<LanguageModelClient>;

                processor = new GTDProcessor(mockClient, ['personal', 'work'], mockModel);
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
                        const mockResponse = buildClaudeResponse({
                                nextAction: 'Call Dr. Smith at 555-0123 to schedule dental cleaning',
                                reasoning: 'This is a single, specific action that can be completed in one call'
                        });

                        mockClient.sendMessage.mockResolvedValue(mockResponse);

			const result = await processor.processInboxItem('call dentist', []);

			expect(result).toMatchObject({
				isActionable: true,
				category: 'next-action',
				nextAction: 'Call Dr. Smith at 555-0123 to schedule dental cleaning',
				suggestedProjects: []
			});

                        expect(mockClient.sendMessage).toHaveBeenCalledWith(
                                expect.objectContaining({
                                        model: mockModel,
                                        maxTokens: 2000
                                })
                        );
		});

		it('should process a project with outcome and future actions', async () => {
			const mockResponse = buildClaudeResponse({
						category: 'project',
						projectOutcome: 'Summer vacation fully planned and booked',
						nextAction: 'Email Sarah to discuss preferred vacation dates',
						reasoning: 'Planning a vacation requires multiple steps',
						futureActions: [
							'Research destinations',
							'Book flights',
							'Reserve accommodation'
						],
						recommendedAction: 'create-project',
						recommendedActionReasoning: 'This item requires a dedicated project with multiple follow-up steps.'
					});

			mockClient.sendMessage.mockResolvedValue(mockResponse);

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
                        const mockResponse = buildClaudeResponse({
                                                nextAction: 'Research and compare gym membership options in my area',
                                                reasoning: 'This is related to the existing Health and Fitness project',
                                                suggestedProjects: [
                                                        {
                                                                projectTitle: 'Health and Fitness',
                                                                relevance: 'This action relates to getting started with fitness activities',
                                                                confidence: 'high'
                                                        }
                                                ],
                                                recommendedAction: 'add-to-project',
                                                recommendedActionReasoning: 'This should be tracked within the existing Health and Fitness project.'
                                        });

			mockClient.sendMessage.mockResolvedValue(mockResponse);

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

                        const mockResponse = buildClaudeResponse({
                                                nextAction: 'Draft initial outline for 3-day office document',
                                                reasoning: 'This relates to creating a counter argument document',
                                                suggestedProjects: [
                                                        {
                                                                projectTitle: '3-day office counter argument',
                                                                relevance: 'This is about creating the same document',
                                                                confidence: 'high'
                                                        }
                                                ],
                                                recommendedAction: 'add-to-project',
                                                recommendedActionReasoning: 'This action belongs within the existing project.'
                                        });

			mockClient.sendMessage.mockResolvedValue(mockResponse);

			const result = await processor.processInboxItem(
				'Start doc for 3 day in the office counter argument',
				projectsWithSpecificTitle
			);

			expect(result.suggestedProjects).toHaveLength(1);
			expect(result.suggestedProjects![0].project.title).toBe(
				'Create a 3-day office counter argument'
			);
		});

		it('should treat null reference content as absent', async () => {
			const mockResponse = buildClaudeResponse({
				referenceContent: null,
				nextAction: 'Email Stuart to schedule a chat about AI stuff'
			});

			mockClient.sendMessage.mockResolvedValue(mockResponse);

			const result = await processor.processInboxItem(
				'Email Stuart to schedule a chat about AI stuff',
				[]
			);

			expect(result.referenceContent).toBeUndefined();
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

                        const mockResponse = buildClaudeResponse({
                                                nextAction: 'Set fitness goals',
                                                reasoning: 'Related to health tracking',
                                                suggestedProjects: [
                                                        {
                                                                projectTitle: 'Health and Fitness Goals',
                                                                relevance: 'Same project, different punctuation',
                                                                confidence: 'high'
                                                        }
                                                ],
                                                recommendedAction: 'add-to-project',
                                                recommendedActionReasoning: 'This belongs with the existing Health and Fitness project.'
                                        });

			mockClient.sendMessage.mockResolvedValue(mockResponse);

			const result = await processor.processInboxItem('track fitness', projectsWithPunctuation);

			expect(result.suggestedProjects).toHaveLength(1);
			expect(result.suggestedProjects![0].project.title).toBe('Health & Fitness Goals');
		});

		it('should not match projects below similarity threshold', async () => {
                        const mockResponse = buildClaudeResponse({
                                                nextAction: 'Research quantum computing',
                                                reasoning: 'Not related to existing projects',
                                                suggestedProjects: [
                                                        {
                                                                projectTitle: 'Completely Unrelated Project Name',
                                                                relevance: 'Not actually related',
                                                                confidence: 'low'
                                                        }
                                                ],
                                                recommendedAction: 'next-actions-file',
                                                recommendedActionReasoning: 'This is a standalone research task.'
                                        });

			mockClient.sendMessage.mockResolvedValue(mockResponse);

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

                        const mockResponse = buildClaudeResponse({
                                                nextAction: 'Update website',
                                                reasoning: 'Website work',
                                                suggestedProjects: [
                                                        {
                                                                projectTitle: 'Website',
                                                                relevance: 'Exact match',
                                                                confidence: 'high'
                                                        }
                                                ],
                                                recommendedAction: 'add-to-project',
                                                recommendedActionReasoning: 'This action should be tracked in the Website project.'
                                        });

			mockClient.sendMessage.mockResolvedValue(mockResponse);

			const result = await processor.processInboxItem('website work', projectsWithSimilarTitles);

			// Should match the exact title 'Website', not 'Website Redesign'
			expect(result.suggestedProjects).toHaveLength(1);
			expect(result.suggestedProjects![0].project.title).toBe('Website');
		});

		it('should include project context in the prompt', async () => {
                        const mockResponse = buildClaudeResponse({
                                                nextAction: 'Test action',
                                                reasoning: 'Test'
                                        });

			mockClient.sendMessage.mockResolvedValue(mockResponse);

			await processor.processInboxItem('test item', mockProjects);

			const callArgs = mockClient.sendMessage.mock.calls[0][0];
			const prompt = callArgs.messages[0].content;

			expect(prompt).toContain('Health and Fitness');
			expect(prompt).toContain('Website Redesign');
			expect(prompt).toContain('Book gym membership');
		});

		it('should handle reference items', async () => {
                        const mockResponse = buildClaudeResponse({
                                                isActionable: false,
                                                category: 'reference',
                                                nextAction: 'Store in recipe collection',
                                                reasoning: 'This is information to keep for later, no action needed',
                                                recommendedAction: 'reference',
                                                recommendedActionReasoning: 'Store it in your reference materials.'
                                        });

			mockClient.sendMessage.mockResolvedValue(mockResponse);

			const result = await processor.processInboxItem('recipe for lasagna', []);

			expect(result).toMatchObject({
				isActionable: false,
				category: 'reference'
			});
		});

		it('should handle someday/maybe items', async () => {
                        const mockResponse = buildClaudeResponse({
                                                isActionable: false,
                                                category: 'someday',
                                                nextAction: 'Add to someday/maybe list',
                                                reasoning: 'Not actionable right now but might be in the future',
                                                recommendedAction: 'someday-file',
                                                recommendedActionReasoning: 'Capture it in the someday/maybe list for future review.'
                                        });

			mockClient.sendMessage.mockResolvedValue(mockResponse);

			const result = await processor.processInboxItem('learn to play piano', []);

			expect(result).toMatchObject({
				isActionable: false,
				category: 'someday'
			});
		});

		it('should strip markdown code blocks from response', async () => {
                        const mockResponse = '```json\n' +
                                                buildClaudeResponse({
                                                        nextAction: 'Test action',
                                                        reasoning: 'Test'
                                                }) +
                                                '\n```';

			mockClient.sendMessage.mockResolvedValue(mockResponse);

			const result = await processor.processInboxItem('test', []);

			expect(result.nextAction).toBe('Test action');
		});

		it('should derive nextAction from nextActions when primary value is missing', async () => {
			const mockResponse = JSON.stringify({
				isActionable: true,
				category: 'person',
				nextAction: null,
				nextActions: ['Discuss AI stuff with Stuart'],
				reasoning: 'Discuss this topic directly with Stuart.',
				suggestedProjects: [],
				suggestedPersons: [],
				recommendedAction: 'person',
				recommendedActionReasoning: 'Track this against the relevant person note.'
			});

			mockClient.sendMessage.mockResolvedValue(mockResponse);

			const result = await processor.processInboxItem('Chase Stuart on AI stuff', []);

			expect(result.nextAction).toBe('Discuss AI stuff with Stuart');
			expect(result.nextActions).toEqual(['Discuss AI stuff with Stuart']);
		});

		it('should throw error on API failure', async () => {
			mockClient.sendMessage.mockRejectedValue(new Error('API Error'));

			await expect(
				processor.processInboxItem('test', [])
			).rejects.toThrow('Failed to process inbox item: API Error');
		});

                it('should throw error on invalid JSON response', async () => {
                        const mockResponse = 'Invalid JSON response';

                        mockClient.sendMessage.mockResolvedValue(mockResponse);

                        await expect(
                                processor.processInboxItem('test', [])
                        ).rejects.toThrow('Failed to parse model response');
                });

                it('should throw descriptive error when nextAction is missing', async () => {
                        const mockResponse = JSON.stringify({
                                                isActionable: true,
                                                category: 'next-action',
                                                reasoning: 'Test reasoning',
                                                suggestedProjects: [],
                                                recommendedAction: 'next-actions-file',
                                                recommendedActionReasoning: 'Test recommendation.'
                                        });

                        mockClient.sendMessage.mockResolvedValue(mockResponse);

                        await expect(
                                processor.processInboxItem('test', [])
                        ).rejects.toThrow(
                                'Failed to process inbox item: Invalid model response: actionable items must include a non-empty "nextAction" string or a "nextActions" array of non-empty strings'
                        );
                });

                it('should throw descriptive error when actionable nextAction is empty', async () => {
                        const mockResponse = JSON.stringify({
                                                isActionable: true,
                                                category: 'next-action',
                                                nextAction: '   ',
                                                reasoning: 'Test reasoning',
                                                suggestedProjects: [],
                                                recommendedAction: 'next-actions-file',
                                                recommendedActionReasoning: 'Test recommendation.'
                                        });

                        mockClient.sendMessage.mockResolvedValue(mockResponse);

                        await expect(
                                processor.processInboxItem('test', [])
                        ).rejects.toThrow(
                                'Failed to process inbox item: Invalid model response: "nextAction" must be a non-empty string for actionable items'
                        );
                });

                it('should throw descriptive error when recommendedAction is invalid', async () => {
                        const mockResponse = JSON.stringify({
                                                isActionable: true,
                                                category: 'next-action',
                                                nextAction: 'Test action',
                                                reasoning: 'Test reasoning',
                                                suggestedProjects: [],
                                                recommendedAction: 'invalid-action',
                                                recommendedActionReasoning: 'Test recommendation.'
                                        });

                        mockClient.sendMessage.mockResolvedValue(mockResponse);

                        await expect(
                                processor.processInboxItem('test', [])
                        ).rejects.toThrow(
                                'Failed to process inbox item: Invalid model response: "recommendedAction" must be one of create-project/add-to-project/next-actions-file/someday-file/reference/person/trash/discard'
                        );
                });

                it('should handle empty project list', async () => {
                        const mockResponse = buildClaudeResponse({
                                                nextAction: 'Test action',
                                                reasoning: 'Test'
                                        });

			mockClient.sendMessage.mockResolvedValue(mockResponse);

			await processor.processInboxItem('test item', []);

			const callArgs = mockClient.sendMessage.mock.calls[0][0];
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

                        const mockResponse = buildClaudeResponse({
                                                nextAction: 'Test action',
                                                reasoning: 'Test'
                                        });

			mockClient.sendMessage.mockResolvedValue(mockResponse);

			await processor.processInboxItem('test', manyProjects);

			const callArgs = mockClient.sendMessage.mock.calls[0][0];
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

			const mockResponse = JSON.stringify({
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
					});

			mockClient.sendMessage.mockResolvedValue(mockResponse);

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
			const mockResponse = '```json\n' + JSON.stringify({
						prioritizedActions: [],
						overallGuidance: 'Test guidance'
					}) + '\n```';

			mockClient.sendMessage.mockResolvedValue(mockResponse);

			const result = await processor.prioritizeActions(['test action']);

			expect(result.overallGuidance).toBe('Test guidance');
		});

		it('should throw error on API failure', async () => {
			mockClient.sendMessage.mockRejectedValue(new Error('API Error'));

			await expect(
				processor.prioritizeActions(['test'])
			).rejects.toThrow('Failed to prioritize actions: API Error');
		});
	});
});
