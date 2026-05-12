// ABOUTME: Tests for cover image generation functionality
// ABOUTME: Validates image generation via OpenRouter and frontmatter updates

import { generateCoverImage } from "../src/cover-image-generator";
import { requestUrl, TFile, Vault } from "obsidian";
import { PluginSettings } from "../src/types";
import { generateDeterministicFakeApiKey } from "./test-utils";

const requestUrlMock = requestUrl as jest.MockedFunction<typeof requestUrl>;

const mockBase64Image =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function mockOpenRouterResponse(json: unknown, status = 200): void {
  requestUrlMock.mockResolvedValue({
    status,
    headers: {},
    arrayBuffer: new ArrayBuffer(0),
    json,
    text: JSON.stringify(json),
  });
}

function mockSuccessfulImageGeneration(): void {
  mockOpenRouterResponse({
    choices: [
      {
        message: {
          role: "assistant",
          content: "I've generated an image for you.",
          images: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${mockBase64Image}`,
              },
            },
          ],
        },
      },
    ],
  });
}

describe("generateCoverImage", () => {
  let mockVault: jest.Mocked<Vault>;
  let mockSettings: PluginSettings;
  let mockProjectFile: jest.Mocked<TFile>;

  beforeEach(() => {
    requestUrlMock.mockReset();

    mockVault = {
      read: jest.fn(),
      modify: jest.fn(),
      adapter: {
        exists: jest.fn(),
        mkdir: jest.fn(),
        writeBinary: jest.fn(),
      },
    } as unknown as jest.Mocked<Vault>;

    mockSettings = {
      openrouterApiKey: generateDeterministicFakeApiKey("openrouter-test"),
      openrouterBaseUrl: "https://openrouter.ai/api/v1",
      openrouterImageModel: "google/gemini-2.5-flash-image",
      coverImagesFolderPath: "Assets/flow-project-cover-images",
    } as PluginSettings;

    mockProjectFile = {
      path: "Projects/Test Project.md",
      basename: "Test Project",
    } as jest.Mocked<TFile>;
  });

  it("should fail if project already has a cover image", async () => {
    const projectContentWithImage = `---
creation-date: 2025-11-12
tags: project/work
cover-image: Assets/flow-project-cover-images/existing-image.png
---

# Test Project

Project description`;

    mockVault.read.mockResolvedValue(projectContentWithImage);

    await expect(generateCoverImage(mockVault, mockProjectFile, mockSettings)).rejects.toThrow(
      "Project already has a cover image"
    );
  });

  it("should generate and save a cover image for a project without one", async () => {
    const projectContent = `---
creation-date: 2025-11-12
tags: project/work
---

# Test Project

Project description`;

    mockVault.read.mockResolvedValue(projectContent);
    (mockVault.adapter.exists as jest.Mock).mockResolvedValue(false);

    mockSuccessfulImageGeneration();

    const result = await generateCoverImage(mockVault, mockProjectFile, mockSettings);

    // Verify folder creation was attempted
    expect(mockVault.adapter.mkdir).toHaveBeenCalledWith("Assets/flow-project-cover-images");

    // Verify image was saved
    expect(mockVault.adapter.writeBinary).toHaveBeenCalled();

    // Verify frontmatter was updated
    expect(mockVault.modify).toHaveBeenCalledWith(
      mockProjectFile,
      expect.stringContaining("cover-image:")
    );

    // Verify return value includes image path
    expect(result.imagePath).toMatch(/^Assets\/flow-project-cover-images\/[\w-]+\.png$/);

    expect(requestUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://openrouter.ai/api/v1/chat/completions",
        method: "POST",
        contentType: "application/json",
        throw: false,
      })
    );
  });

  it("should use filename (not H1 heading) in the generation prompt", async () => {
    const projectContent = `---
creation-date: 2025-11-12
tags: project/work
---

# My Cool Project

Project description`;

    mockVault.read.mockResolvedValue(projectContent);
    (mockVault.adapter.exists as jest.Mock).mockResolvedValue(true);

    mockSuccessfulImageGeneration();

    await generateCoverImage(mockVault, mockProjectFile, mockSettings);

    // Verify the prompt contains the filename (Test Project), not the H1 heading (My Cool Project)
    const requestBody = JSON.parse(String(requestUrlMock.mock.calls[0][0].body));
    expect(requestBody.messages[0].content).toContain("Test Project");
    expect(requestBody.messages[0].content).not.toContain("My Cool Project");
  });

  it("should use Obsidian requestUrl and handle API errors gracefully", async () => {
    const projectContent = `---
creation-date: 2025-11-12
tags: project/work
---

# Test Project

Project description`;

    mockVault.read.mockResolvedValue(projectContent);
    (mockVault.adapter.exists as jest.Mock).mockResolvedValue(true);

    mockOpenRouterResponse(
      {
        error: {
          message: "Internal server error",
        },
      },
      500
    );

    await expect(generateCoverImage(mockVault, mockProjectFile, mockSettings)).rejects.toThrow(
      "Image generation failed: Internal server error"
    );
    expect(requestUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        throw: false,
      })
    );
  });

  it("should reject malformed image data from OpenRouter", async () => {
    const projectContent = `---
creation-date: 2025-11-12
tags: project/work
---

# Test Project

Project description`;

    mockVault.read.mockResolvedValue(projectContent);
    (mockVault.adapter.exists as jest.Mock).mockResolvedValue(true);

    mockOpenRouterResponse({
      choices: [
        {
          message: {
            role: "assistant",
            images: [
              {
                type: "image_url",
                image_url: {
                  url: "not-a-data-url",
                },
              },
            ],
          },
        },
      ],
    });

    await expect(generateCoverImage(mockVault, mockProjectFile, mockSettings)).rejects.toThrow(
      "Invalid image data URL returned from API"
    );
  });

  it("should decode base64 image data without relying on global atob", async () => {
    const projectContent = `---
creation-date: 2025-11-12
tags: project/work
---

# Test Project

Project description`;
    const originalAtob = globalThis.atob;

    mockVault.read.mockResolvedValue(projectContent);
    (mockVault.adapter.exists as jest.Mock).mockResolvedValue(true);
    mockSuccessfulImageGeneration();

    try {
      Object.defineProperty(globalThis, "atob", {
        configurable: true,
        value: undefined,
      });

      await generateCoverImage(mockVault, mockProjectFile, mockSettings);
    } finally {
      Object.defineProperty(globalThis, "atob", {
        configurable: true,
        value: originalAtob,
      });
    }

    expect(mockVault.adapter.writeBinary).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(ArrayBuffer)
    );
  });
});
