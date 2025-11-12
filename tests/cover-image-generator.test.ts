// ABOUTME: Tests for cover image generation functionality
// ABOUTME: Validates image generation via OpenRouter and frontmatter updates

import { generateCoverImage } from "../src/cover-image-generator";
import { TFile, Vault } from "obsidian";
import { PluginSettings } from "../src/types";
import { generateDeterministicFakeApiKey } from "./test-utils";

describe("generateCoverImage", () => {
  let mockVault: jest.Mocked<Vault>;
  let mockSettings: PluginSettings;
  let mockProjectFile: jest.Mocked<TFile>;

  beforeEach(() => {
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
      openaiApiKey: generateDeterministicFakeApiKey("openrouter-test"),
      openaiBaseUrl: "https://openrouter.ai/api/v1",
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

    // Mock successful image generation using chat completions format
    const mockBase64Image =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; // 1x1 transparent PNG
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
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
      }),
    });

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
  });

  it("should use project name in the generation prompt", async () => {
    const projectContent = `---
creation-date: 2025-11-12
tags: project/work
---

# My Cool Project

Project description`;

    mockVault.read.mockResolvedValue(projectContent);
    (mockVault.adapter.exists as jest.Mock).mockResolvedValue(true);

    const mockBase64Image =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: "assistant",
              content: "Image generated",
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
      }),
    });

    await generateCoverImage(mockVault, mockProjectFile, mockSettings);

    // Verify the prompt contains the project name
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("My Cool Project"),
      })
    );
  });

  it("should handle API errors gracefully", async () => {
    const projectContent = `---
creation-date: 2025-11-12
tags: project/work
---

# Test Project

Project description`;

    mockVault.read.mockResolvedValue(projectContent);
    (mockVault.adapter.exists as jest.Mock).mockResolvedValue(true);

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          message: "Internal server error",
        },
      }),
    });

    await expect(generateCoverImage(mockVault, mockProjectFile, mockSettings)).rejects.toThrow();
  });
});
