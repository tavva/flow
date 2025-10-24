// ABOUTME: Analyzes GTD system state to detect issues like stalled projects and large inboxes.
// ABOUTME: Provides structured issue detection for CLI opening messages.

import { GTDContext } from "./gtd-context-scanner";
import { FlowProject } from "./types";

export interface SystemIssues {
  stalledProjects: number;
  inboxCount: number;
  inboxNeedsAttention: boolean;
  hasIssues: boolean;
}

export class SystemAnalyzer {
  /**
   * Analyze GTD system for issues
   * @param gtdContext - Scanned GTD context (inbox, actions, someday items)
   * @param projects - All projects for the sphere
   * @param inboxThreshold - Inbox size that triggers attention flag (default: 5)
   */
  static analyze(
    gtdContext: GTDContext,
    projects: FlowProject[],
    inboxThreshold: number = 5
  ): SystemIssues {
    const stalledProjects = projects.filter((p) => p.nextActions.length === 0).length;

    const inboxCount = gtdContext.inboxItems.length;
    const inboxNeedsAttention = inboxCount > inboxThreshold;

    return {
      stalledProjects,
      inboxCount,
      inboxNeedsAttention,
      hasIssues: stalledProjects > 0 || inboxNeedsAttention,
    };
  }
}
