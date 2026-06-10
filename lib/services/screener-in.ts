/**
 * @fileoverview screener.in query service for Indian stocks.
 * Runs screener.in's query language (e.g. "Market Capitalization > 500 AND
 * ROCE > 22") against https://www.screener.in/screen/raw/ and parses the
 * HTML results table. Ad-hoc queries require a logged-in session, so this
 * service authenticates with SCREENER_IN_EMAIL / SCREENER_IN_PASSWORD.
 */

import * as cheerio from "cheerio";
import { APIError, ConfigurationError } from "../errors";
import { createServiceLogger } from "../logger";

const log = createServiceLogger("ScreenerInService");

const BASE_URL = "https://www.screener.in";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

export interface ScreenerInQueryParams {
  /** screener.in query language, e.g. "Market Capitalization > 500 AND ROCE > 22" */
  query: string;
  /** Full ratio name to sort by, e.g. "market capitalization" */
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  /** screener.in only renders 10, 25, or 50 rows per page */
  pageSize?: 10 | 25 | 50;
}

export interface ScreenerInRow {
  name: string;
  /** BSE code or NSE symbol from the company URL */
  code?: string;
  url?: string;
  /** Column values keyed by full ratio name; null when blank on screener.in */
  values: Record<string, number | null>;
}

export interface ScreenerInColumn {
  /** Full ratio name (from the header tooltip), used as the key in row values */
  name: string;
  /** Unit shown in the header, e.g. "Rs.Cr." or "%" */
  unit?: string;
}

export interface ScreenerInResult {
  total: number;
  page: number;
  totalPages: number;
  query: string;
  columns: ScreenerInColumn[];
  rows: ScreenerInRow[];
}

export class ScreenerInService {
  private readonly cookies = new Map<string, string>();
  private loggedIn = false;

  private getCredentials(): { email: string; password: string } {
    const email = process.env.SCREENER_IN_EMAIL;
    const password = process.env.SCREENER_IN_PASSWORD;
    if (!email || !password) {
      throw new ConfigurationError(
        "screener.in queries require a logged-in account. Set SCREENER_IN_EMAIL and SCREENER_IN_PASSWORD in the environment (free account at https://www.screener.in/register/)."
      );
    }
    return { email, password };
  }

  private storeCookies(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(";")[0] ?? "";
      const eq = pair.indexOf("=");
      if (eq > 0) {
        this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    }
  }

  private cookieHeader(): string {
    return [...this.cookies.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  private async login(): Promise<void> {
    const { email, password } = this.getCredentials();
    this.cookies.clear();

    const loginPage = await fetch(`${BASE_URL}/login/`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!loginPage.ok) {
      throw new APIError(
        `Failed to load screener.in login page: HTTP ${loginPage.status}`,
        "screener.in",
        502
      );
    }
    this.storeCookies(loginPage);

    const html = await loginPage.text();
    const csrfToken = html.match(
      /name="csrfmiddlewaretoken"\s+value="([^"]+)"/
    )?.[1];
    if (!csrfToken) {
      throw new APIError(
        "Could not find CSRF token on screener.in login page",
        "screener.in",
        502
      );
    }

    const response = await fetch(`${BASE_URL}/login/`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: this.cookieHeader(),
        Referer: `${BASE_URL}/login/`,
        Origin: BASE_URL,
      },
      body: new URLSearchParams({
        csrfmiddlewaretoken: csrfToken,
        username: email,
        password,
        next: "",
      }),
    });
    this.storeCookies(response);

    // Django redirects on success; a 200 re-renders the form with errors.
    if (response.status !== 302 || !this.cookies.has("sessionid")) {
      throw new APIError(
        "screener.in login failed — check SCREENER_IN_EMAIL and SCREENER_IN_PASSWORD",
        "screener.in",
        401
      );
    }

    this.loggedIn = true;
    log.info("Logged in to screener.in");
  }

  private parseNumber(text: string): number | null {
    const cleaned = text.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : null;
  }

  private parseResults(html: string, query: string): ScreenerInResult {
    const $ = cheerio.load(html);

    // "5,330 results found: Showing page 1 of 214"
    const countText = $("body").text();
    const countMatch = countText.match(
      /([\d,]+)\s+results?\s+found:\s+Showing page (\d+) of (\d+)/
    );
    const total = Number(countMatch?.[1]?.replace(/,/g, "") ?? 0);
    const page = Number(countMatch?.[2] ?? 1);
    const totalPages = Number(countMatch?.[3] ?? 1);

    const table = $("table.data-table").first();

    // Header row: th cells carry the full ratio name in data-tooltip and the
    // unit in a span. The first two (S.No., Name) are positional, not ratios.
    const columns: ScreenerInColumn[] = [];
    table
      .find("tr")
      .first()
      .find("th[data-tooltip]")
      .each((_, th) => {
        const cell = $(th);
        const unit = cell.find("a span").text().trim();
        columns.push({
          name: cell.attr("data-tooltip") ?? cell.text().trim(),
          ...(unit ? { unit } : {}),
        });
      });

    const rows: ScreenerInRow[] = [];
    table.find("tr[data-row-company-id]").each((_, tr) => {
      const link = $(tr).find("td.text a").first();
      const name = link.text().trim();
      if (!name) return;

      const href = link.attr("href");
      const code = href?.match(/^\/company\/([^/]+)/)?.[1];

      const values: Record<string, number | null> = {};
      // Numeric tds follow the two .text cells (serial number + name) in
      // the same order as the header columns.
      $(tr)
        .find("td")
        .not(".text")
        .each((index, td) => {
          const column = columns[index];
          if (column) {
            values[column.name] = this.parseNumber($(td).text());
          }
        });

      rows.push({
        name,
        ...(code ? { code } : {}),
        ...(href ? { url: `${BASE_URL}${href}` } : {}),
        values,
      });
    });

    return { total, page, totalPages, query, columns, rows };
  }

  async runQuery(params: ScreenerInQueryParams): Promise<ScreenerInResult> {
    const { query, sortBy, sortOrder = "desc", page = 1, pageSize } = params;
    if (!query.trim()) {
      throw new APIError("query must not be empty", "screener.in", 400);
    }

    if (!this.loggedIn) {
      await this.login();
    }

    const search = new URLSearchParams({
      sort: sortBy?.toLowerCase() ?? "",
      order: sortBy ? sortOrder : "",
      source_id: "",
      query,
    });
    if (page > 1) search.set("page", String(page));
    if (pageSize) search.set("limit", String(pageSize));
    const url = `${BASE_URL}/screen/raw/?${search.toString()}`;

    const request = async (): Promise<Response> =>
      fetch(url, {
        redirect: "manual",
        headers: {
          "User-Agent": USER_AGENT,
          Cookie: this.cookieHeader(),
          Referer: `${BASE_URL}/explore/`,
        },
      });

    let response = await request();
    // A redirect means the session expired (guests get bounced to /register/).
    if (response.status >= 300 && response.status < 400) {
      await this.login();
      response = await request();
    }
    if (!response.ok) {
      throw new APIError(
        `screener.in query failed: HTTP ${response.status}`,
        "screener.in",
        502
      );
    }
    this.storeCookies(response);

    const html = await response.text();
    const result = this.parseResults(html, query);

    // screener.in renders query errors (unknown ratios, bad syntax) inline
    // instead of a results table.
    if (result.rows.length === 0 && result.total === 0) {
      const $ = cheerio.load(html);
      const error = $(".error, .errorlist, [class*='flash']").text().trim();
      if (error) {
        throw new APIError(
          `screener.in rejected the query: ${error}`,
          "screener.in",
          400
        );
      }
    }
    return result;
  }
}

export const screenerInService = new ScreenerInService();
