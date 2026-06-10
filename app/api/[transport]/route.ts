/**
 * @fileoverview MCP (Model Context Protocol) API handlers.
 * Exposes Indian stock and mutual fund screener tools for AI agent integration.
 */

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

import { screenerInService } from "@/lib/services/screener-in";
import {
  indiaFundScreenerService,
  INDIA_FUND_SCREENER_FIELDS,
} from "@/lib/services/india-fund-screener";
import {
  SCREENER_IN_QUERY_DESCRIPTION,
  INDIA_FUND_SCREENER_DESCRIPTION,
} from "@/lib/tool-descriptions";
import { formatMcpContent } from "@/lib/mcp-utils";

const handler = createMcpHandler(
  server => {
    server.registerTool(
      "query_india_screener",
      {
        title: "Query India Screener (screener.in)",
        description: SCREENER_IN_QUERY_DESCRIPTION,
        inputSchema: {
          query: z
            .string()
            .min(1)
            .describe(
              'screener.in query, e.g. "Market Capitalization > 500 AND ROCE > 22"'
            ),
          sortBy: z
            .string()
            .optional()
            .describe(
              'Full ratio name to sort by, lowercase (e.g. "market capitalization")'
            ),
          sortOrder: z.enum(["asc", "desc"]).default("desc"),
          page: z.number().min(1).default(1).describe("Page number (1-based)"),
          pageSize: z
            .union([z.literal(10), z.literal(25), z.literal(50)])
            .default(25)
            .describe("Results per page — screener.in allows 10, 25, or 50"),
        },
      },
      async ({ query, sortBy, sortOrder, page, pageSize }) =>
        formatMcpContent(
          await screenerInService.runQuery({
            query,
            sortBy,
            sortOrder,
            page,
            pageSize,
          })
        )
    );

    server.registerTool(
      "get_india_fund_screener",
      {
        title: "Get India Mutual Fund Screener",
        description: INDIA_FUND_SCREENER_DESCRIPTION,
        inputSchema: {
          filters: z
            .array(
              z.object({
                field: z
                  .enum(INDIA_FUND_SCREENER_FIELDS as [string, ...string[]])
                  .describe("Field to filter on"),
                operator: z
                  .enum(["GT", "LT", "BTW", "IN"])
                  .describe(
                    "GT/LT take one value, BTW takes [min, max], IN matches any listed value"
                  ),
                values: z
                  .array(z.union([z.string(), z.number()]))
                  .min(1)
                  .describe("Filter values"),
              })
            )
            .default([])
            .describe("Filter criteria, combined with AND"),
          term: z.string().optional().describe("Free-text fund name search"),
          sortField: z
            .enum(INDIA_FUND_SCREENER_FIELDS as [string, ...string[]])
            .default("fundSize")
            .describe("Field to sort by"),
          sortOrder: z.enum(["asc", "desc"]).default("desc"),
          page: z.number().min(1).default(1).describe("Page number (1-based)"),
          pageSize: z
            .number()
            .min(1)
            .max(100)
            .default(25)
            .describe("Results per page (max 100)"),
        },
      },
      async ({ filters, term, sortField, sortOrder, page, pageSize }) =>
        formatMcpContent(
          await indiaFundScreenerService.runScreener({
            filters,
            term,
            sortField,
            sortOrder,
            page,
            pageSize,
          })
        )
    );
  },
  {
    serverInfo: { name: "india-screener-mcp", version: "1.0.0" },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: true,
  }
);

export { handler as GET, handler as POST };
