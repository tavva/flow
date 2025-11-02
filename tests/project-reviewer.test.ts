import { ProjectReviewer } from "../src/project-reviewer";
import { FlowProject, ProjectReviewResponse } from "../src/types";
import { LanguageModelClient } from "../src/language-model";

describe("ProjectReviewer", () => {
  let reviewer: ProjectReviewer;
  let mockClient: jest.Mocked<LanguageModelClient>;
  const mockModel = "claude-test-model";

  const buildReviewResponse = (overrides: Partial<ProjectReviewResponse> = {}): string =>
    JSON.stringify({
      projectsOk: [],
      improvements: [],
      merges: [],
      statusChanges: [],
      ...overrides,
    });

  beforeEach(() => {
    mockClient = {
      sendMessage: jest.fn(),
    } as jest.Mocked<LanguageModelClient>;

    reviewer = new ProjectReviewer(mockClient, mockModel);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("reviewProjects", () => {
    const mockProjects: FlowProject[] = [
      {
        file: "projects/health.md",
        title: "Health stuff",
        tags: ["project/personal"],
        status: "live",
        nextActions: ["gym"],
      },
      {
        file: "projects/website.md",
        title: "Website redesign complete",
        tags: ["project/work"],
        status: "live",
        nextActions: ["Call designer Sarah at 555-1234 to discuss color scheme"],
      },
    ];

    it("should return projects that look good", async () => {
      const mockResponse = buildReviewResponse({
        projectsOk: ["projects/website.md"],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      const result = await reviewer.reviewProjects(mockProjects, "work");

      expect(result.projectsOk).toEqual(["projects/website.md"]);
      expect(result.improvements).toHaveLength(0);
      expect(result.merges).toHaveLength(0);
      expect(result.statusChanges).toHaveLength(0);
    });

    it("should suggest improvements to project names", async () => {
      const mockResponse = buildReviewResponse({
        improvements: [
          {
            projectPath: "projects/health.md",
            currentName: "Health stuff",
            suggestedName: "Health and fitness goals achieved",
            currentDescription: "",
            rationale: "Project name should state the successful outcome, not just 'stuff'",
          },
        ],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      const result = await reviewer.reviewProjects(mockProjects, "personal");

      expect(result.improvements).toHaveLength(1);
      expect(result.improvements[0]).toMatchObject({
        projectPath: "projects/health.md",
        currentName: "Health stuff",
        suggestedName: "Health and fitness goals achieved",
        rationale: expect.stringContaining("successful outcome"),
      });
    });

    it("should suggest improvements to next actions", async () => {
      const mockResponse = buildReviewResponse({
        improvements: [
          {
            projectPath: "projects/health.md",
            currentName: "Health stuff",
            currentDescription: "Track my health goals",
            nextActionImprovements: [
              {
                current: "gym",
                suggested: "Call local gym at 555-9999 to ask about membership options",
              },
            ],
            rationale: "Next action is too vague and doesn't start with an action verb",
          },
        ],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      const result = await reviewer.reviewProjects(mockProjects, "personal");

      expect(result.improvements).toHaveLength(1);
      expect(result.improvements[0].nextActionImprovements).toHaveLength(1);
      expect(result.improvements[0].nextActionImprovements![0]).toMatchObject({
        current: "gym",
        suggested: "Call local gym at 555-9999 to ask about membership options",
      });
    });

    it("should suggest merging duplicate projects", async () => {
      const duplicateProjects: FlowProject[] = [
        {
          file: "projects/website-v1.md",
          title: "Website redesign",
          tags: ["project/work"],
          status: "live",
          nextActions: ["Meet with designer"],
        },
        {
          file: "projects/website-v2.md",
          title: "New website",
          tags: ["project/work"],
          status: "live",
          nextActions: ["Review mockups"],
        },
      ];

      const mockResponse = buildReviewResponse({
        merges: [
          {
            primaryProject: "projects/website-v1.md",
            projectsToMerge: ["projects/website-v2.md"],
            combinedNextActions: ["Meet with designer", "Review mockups"],
            rationale: "Both projects are about the same website redesign effort",
          },
        ],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      const result = await reviewer.reviewProjects(duplicateProjects, "work");

      expect(result.merges).toHaveLength(1);
      expect(result.merges[0]).toMatchObject({
        primaryProject: "projects/website-v1.md",
        projectsToMerge: ["projects/website-v2.md"],
        combinedNextActions: ["Meet with designer", "Review mockups"],
        rationale: expect.stringContaining("same website"),
      });
    });

    it("should suggest status changes", async () => {
      const staleProject: FlowProject[] = [
        {
          file: "projects/old-project.md",
          title: "Old project",
          tags: ["project/work"],
          status: "live",
          nextActions: [],
        },
      ];

      const mockResponse = buildReviewResponse({
        statusChanges: [
          {
            projectPath: "projects/old-project.md",
            currentStatus: "live",
            suggestedStatus: "completed",
            rationale: "No next actions defined, project appears to be dormant",
          },
        ],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      const result = await reviewer.reviewProjects(staleProject, "work");

      expect(result.statusChanges).toHaveLength(1);
      expect(result.statusChanges[0]).toMatchObject({
        projectPath: "projects/old-project.md",
        currentStatus: "live",
        suggestedStatus: "completed",
        rationale: expect.stringContaining("dormant"),
      });
    });

    it("should include sphere in the prompt", async () => {
      const mockResponse = buildReviewResponse({
        projectsOk: ["projects/website.md"],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      await reviewer.reviewProjects(mockProjects, "work");

      const callArgs = mockClient.sendMessage.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;

      expect(prompt).toContain('"work" sphere');
      expect(prompt).toContain("Website redesign complete");
    });

    it("should include project details in the prompt", async () => {
      const mockResponse = buildReviewResponse({
        projectsOk: ["projects/website.md"],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      await reviewer.reviewProjects(mockProjects, "work");

      const callArgs = mockClient.sendMessage.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;

      expect(prompt).toContain("Website redesign complete");
      expect(prompt).toContain("projects/website.md");
      expect(prompt).toContain("project/work");
      expect(prompt).toContain("Call designer Sarah");
    });

    it("should use British English in prompt", async () => {
      const mockResponse = buildReviewResponse({
        projectsOk: [],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      await reviewer.reviewProjects(mockProjects, "personal");

      const callArgs = mockClient.sendMessage.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;

      expect(prompt).toContain("British English");
      expect(prompt).toContain("remodelled"); // Example of British spelling
    });

    it("should strip markdown code blocks from response", async () => {
      const mockResponse =
        "```json\n" +
        buildReviewResponse({
          projectsOk: ["projects/website.md"],
        }) +
        "\n```";

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      const result = await reviewer.reviewProjects(mockProjects, "work");

      expect(result.projectsOk).toEqual(["projects/website.md"]);
    });

    it("should throw error on API failure", async () => {
      mockClient.sendMessage.mockRejectedValue(new Error("API Error"));

      await expect(reviewer.reviewProjects(mockProjects, "work")).rejects.toThrow(
        "Failed to review projects: API Error"
      );
    });

    it("should throw error on invalid JSON response", async () => {
      const mockResponse = "Invalid JSON response";

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      await expect(reviewer.reviewProjects(mockProjects, "work")).rejects.toThrow(
        "Failed to parse review response"
      );
    });

    it("should throw error when projectsOk is not an array", async () => {
      const mockResponse = JSON.stringify({
        projectsOk: "not-an-array",
        improvements: [],
        merges: [],
        statusChanges: [],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      await expect(reviewer.reviewProjects(mockProjects, "work")).rejects.toThrow(
        '"projectsOk" must be an array'
      );
    });

    it("should throw error when improvements is not an array", async () => {
      const mockResponse = JSON.stringify({
        projectsOk: [],
        improvements: "not-an-array",
        merges: [],
        statusChanges: [],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      await expect(reviewer.reviewProjects(mockProjects, "work")).rejects.toThrow(
        '"improvements" must be an array'
      );
    });

    it("should throw error when improvement is missing required fields", async () => {
      const mockResponse = JSON.stringify({
        projectsOk: [],
        improvements: [
          {
            projectPath: "projects/test.md",
            // missing currentName, currentDescription, rationale
          },
        ],
        merges: [],
        statusChanges: [],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      await expect(reviewer.reviewProjects(mockProjects, "work")).rejects.toThrow(
        "improvements[0].currentName must be a string"
      );
    });

    it("should throw error when merge is missing required fields", async () => {
      const mockResponse = JSON.stringify({
        projectsOk: [],
        improvements: [],
        merges: [
          {
            primaryProject: "projects/test.md",
            // missing projectsToMerge, combinedNextActions, rationale
          },
        ],
        statusChanges: [],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      await expect(reviewer.reviewProjects(mockProjects, "work")).rejects.toThrow(
        "merges[0].projectsToMerge must be an array"
      );
    });

    it("should throw error when status change has invalid suggestedStatus", async () => {
      const mockResponse = JSON.stringify({
        projectsOk: [],
        improvements: [],
        merges: [],
        statusChanges: [
          {
            projectPath: "projects/test.md",
            currentStatus: "live",
            suggestedStatus: "invalid-status",
            rationale: "Test",
          },
        ],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      await expect(reviewer.reviewProjects(mockProjects, "work")).rejects.toThrow(
        "suggestedStatus must be one of completed/paused"
      );
    });

    it("should handle empty project list", async () => {
      const mockResponse = buildReviewResponse({
        projectsOk: [],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      const result = await reviewer.reviewProjects([], "work");

      expect(result.projectsOk).toEqual([]);
    });

    it("should send correct model and max tokens", async () => {
      const mockResponse = buildReviewResponse({
        projectsOk: [],
      });

      mockClient.sendMessage.mockResolvedValue(mockResponse);

      await reviewer.reviewProjects(mockProjects, "work");

      expect(mockClient.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: mockModel,
          maxTokens: 16000,
        })
      );
    });
  });
});
