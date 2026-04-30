/**
 * Minimal Atlassian Document Format for Jira Cloud REST issue descriptions.
 */
export function plainTextToAdf(text: string): {
  type: string;
  version: number;
  content: Array<{ type: string; content?: Array<{ type: string; text: string }> }>;
} {
  const lines = text.length ? text.split("\n") : [" "];
  return {
    type: "doc",
    version: 1,
    content: lines.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line.length ? line : " " }],
    })),
  };
}
