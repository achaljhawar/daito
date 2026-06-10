/**
 * @fileoverview MCP formatting utilities.
 * Provides consistent JSON structure for AI agent consumption.
 */

export function formatMcpContent(data: unknown): {
  content: { type: "text"; text: string }[];
} {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}
