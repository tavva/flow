// ABOUTME: Entry point for CLI executable with import.meta check
// ABOUTME: Separated from cli.tsx to avoid Jest parse errors when testing

import { main } from "./cli.js";

// Run if executed directly (ESM check)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
