// ABOUTME: Test setup file to configure global mocks and make Obsidian classes
// ABOUTME: available for instanceof checks across all test files.

// Mock obsidian module globally
jest.mock("obsidian");

// Import the mocked classes and make them globally available
import { TFile } from "obsidian";

// Make TFile available globally for instanceof checks
(global as any).TFile = TFile;
