export const buildProjectTitlePrompt = (originalItem: string): string => `Given this inbox item: "${originalItem}"

The user wants to create a project for this. Suggest a clear, concise project title that:
- States the desired outcome (not just the topic)
- Is specific and measurable
- Defines what "done" looks like
- Uses past tense or completion-oriented language when appropriate

Examples:
- Good: "Website redesign complete and deployed"
- Bad: "Website project"
- Good: "Kitchen renovation finished"
- Bad: "Kitchen stuff"

Respond with ONLY the project title, nothing else.`;
