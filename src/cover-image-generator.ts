// ABOUTME: Generates cover images for projects using OpenRouter image generation
// ABOUTME: Saves images to vault and updates project frontmatter

import { requestUrl, TFile, Vault } from "obsidian";
import { PluginSettings } from "./types";
import { v4 as uuidv4 } from "uuid";
import { ValidationError, LLMResponseError } from "./errors";

export interface GenerateCoverImageResult {
  imagePath: string;
}

interface OpenRouterChatResponse {
  choices: Array<{
    message: {
      role: string;
      content?: string;
      images?: Array<{
        type: string;
        image_url: {
          url: string; // base64 data URL
        };
      }>;
    };
  }>;
  error?: {
    message: string;
  };
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Generates a cover image for a project using OpenRouter's image generation API.
 *
 * @param vault - The Obsidian vault instance
 * @param projectFile - The project file to generate an image for
 * @param settings - Plugin settings containing API configuration
 * @returns Promise resolving to the image path
 * @throws Error if the project already has a cover image or if generation fails
 */
export async function generateCoverImage(
  vault: Vault,
  projectFile: TFile,
  settings: PluginSettings
): Promise<GenerateCoverImageResult> {
  // Read project file content
  const content = await vault.read(projectFile);

  // Check if project already has a cover image
  if (content.includes("cover-image:")) {
    throw new ValidationError("Project already has a cover image");
  }

  // Generate unique filename
  const filename = `${uuidv4()}.png`;
  const imagePath = `${settings.coverImagesFolderPath}/${filename}`;

  // Ensure folder exists
  await vault.adapter.mkdir(settings.coverImagesFolderPath);

  // Generate image via OpenRouter
  const imageData = await callOpenRouterImageAPI(
    projectFile.basename,
    settings.openrouterApiKey,
    settings.openrouterBaseUrl,
    settings.openrouterImageModel
  );

  // Save image to vault
  await vault.adapter.writeBinary(imagePath, imageData);

  // Update project frontmatter
  await updateProjectFrontmatter(vault, projectFile, imagePath);

  return { imagePath };
}

/**
 * Calls OpenRouter's image generation API with the project-specific prompt.
 */
async function callOpenRouterImageAPI(
  projectName: string,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<ArrayBuffer> {
  const prompt = buildImagePrompt(projectName);

  const response = await requestUrl({
    url: `${baseUrl}/chat/completions`,
    method: "POST",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/tavva/flow",
      "X-Title": "Flow: cover generator",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      modalities: ["image", "text"],
      image_config: {
        aspect_ratio: "1:1", // Square image for cover
      },
    }),
    throw: false,
  });

  if (response.status < 200 || response.status >= 300) {
    const errorData = response.json as OpenRouterChatResponse;
    throw new LLMResponseError(
      `Image generation failed: ${errorData.error?.message || response.text || `HTTP ${response.status}`}`
    );
  }

  const data = response.json as OpenRouterChatResponse;

  if (!data.choices || data.choices.length === 0) {
    throw new LLMResponseError("No response from image generation API");
  }

  const message = data.choices[0].message;
  if (!message.images || message.images.length === 0) {
    throw new LLMResponseError("No image data returned from API");
  }

  // Extract base64 data URL
  const dataUrl = message.images[0].image_url.url;

  // Convert base64 data URL to ArrayBuffer
  return base64DataUrlToArrayBuffer(dataUrl);
}

/**
 * Converts a base64 data URL to an ArrayBuffer.
 */
function base64DataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  // Extract base64 data from data URL (format: data:image/png;base64,<data>)
  const match = dataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw new LLMResponseError("Invalid image data URL returned from API");
  }

  return decodeBase64ToArrayBuffer(match[1]);
}

function decodeBase64ToArrayBuffer(base64Data: string): ArrayBuffer {
  const normalized = base64Data.replace(/\s/g, "");
  const paddingStart = normalized.indexOf("=");
  const paddingCount = paddingStart === -1 ? 0 : normalized.length - paddingStart;

  if (
    normalized.length === 0 ||
    normalized.length % 4 === 1 ||
    paddingCount > 2 ||
    (paddingStart !== -1 && !/^=+$/.test(normalized.slice(paddingStart)))
  ) {
    throw new LLMResponseError("Invalid image data URL returned from API");
  }

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of normalized) {
    if (char === "=") {
      break;
    }

    const value = BASE64_ALPHABET.indexOf(char);
    if (value === -1) {
      throw new LLMResponseError("Invalid image data URL returned from API");
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes).buffer;
}

/**
 * Builds the image generation prompt with the project name.
 */
function buildImagePrompt(projectName: string): string {
  return `Create an image to be used as a cover image for a project folder in a productivity system. It needs to be distinct and represent the project.

Guidelines:
Style: Simple, bold lines, high contrast, colourful, no transparent background.
Format: Full square, no border, full bleed.
Clarity: Must be clear and recognisable at a very small size.
Content: Absolutely no text or letters.

The project name is: "${projectName}"`;
}

/**
 * Updates the project file's frontmatter to include the cover image path.
 * Re-reads the file to preserve any edits made during image generation.
 */
async function updateProjectFrontmatter(
  vault: Vault,
  projectFile: TFile,
  imagePath: string
): Promise<void> {
  // Re-read file to get current content (preserves edits made during image generation)
  const content = await vault.read(projectFile);

  // Parse frontmatter and add cover-image field
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    // No frontmatter, add it
    const newContent = `---
cover-image: ${imagePath}
---

${content}`;
    await vault.modify(projectFile, newContent);
    return;
  }

  const frontmatter = frontmatterMatch[1];
  const updatedFrontmatter = `${frontmatter}\ncover-image: ${imagePath}`;
  const newContent = content.replace(/^---\n[\s\S]*?\n---/, `---\n${updatedFrontmatter}\n---`);

  await vault.modify(projectFile, newContent);
}
