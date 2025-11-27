// ABOUTME: Project review types for AI-powered project analysis
// ABOUTME: Contains structures for improvements, merges, and status changes

export interface NextActionImprovement {
  current: string;
  suggested: string;
}

export interface ProjectImprovement {
  projectPath: string;
  currentName: string;
  suggestedName?: string;
  currentDescription: string;
  suggestedDescription?: string;
  nextActionImprovements?: NextActionImprovement[];
  rationale: string;
}

export interface ProjectMerge {
  primaryProject: string;
  projectsToMerge: string[];
  combinedNextActions: string[];
  rationale: string;
}

export interface ProjectStatusChange {
  projectPath: string;
  currentStatus: string;
  suggestedStatus: "complete" | "archived" | "paused";
  rationale: string;
}

export interface ProjectReviewResponse {
  projectsOk: string[];
  improvements: ProjectImprovement[];
  merges: ProjectMerge[];
  statusChanges: ProjectStatusChange[];
}

export interface ReviewProtocol {
  filename: string; // e.g., "friday-afternoon.md"
  name: string; // Extracted from first H1, fallback to filename
  trigger?: {
    day?: string; // monday, tuesday, wednesday, thursday, friday, saturday, sunday
    time?: string; // morning, afternoon, evening
  };
  spheres?: string[]; // e.g., ["work", "personal"]
  content: string; // Full markdown body (without frontmatter)
}
