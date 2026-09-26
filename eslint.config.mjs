// ABOUTME: ESLint configuration using Obsidian's recommended plugin rules.
// ABOUTME: Mirrors the automated checks run on community plugin releases.

import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import { DEFAULT_BRANDS } from "eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js";

export default defineConfig([
  {
    // Only plugin code ships to users; tests, scripts and tool configs run under Node.
    ignores: [
      "main.js",
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "scripts/**",
      "tests/**",
      "esbuild.config.mjs",
      "jest.config.cjs",
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.*"],
        },
      },
    },
    rules: {
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          brands: [...DEFAULT_BRANDS, "OpenRouter"],
          ignoreRegex: [
            // OpenRouter API key format shown as a placeholder
            "^sk-or-v1-",
            // Text led by an icon character, which the rule treats as the first word
            "^(?:🗑️|\\+|→) ",
            // Text starting with a number, e.g. "1 (highest) to 5 (lowest)"
            "^\\d",
          ],
        },
      ],
    },
  },
]);
