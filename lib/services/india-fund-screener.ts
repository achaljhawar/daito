/**
 * @fileoverview Indian mutual fund screener service.
 * Screens India-domiciled open-end funds via Morningstar India's ecint
 * screener API (universe FOIND$$ALL, ~12,700 share classes).
 * Auth uses a public retail token embedded in the quickrank page HTML.
 */

import { createServiceLogger } from "../logger";

const log = createServiceLogger("IndiaFundScreenerService");

const QUICKRANK_URL = "https://www.morningstar.in/tools/stock-quickrank.aspx";
const SCREENER_URL = "https://www.apac-api.morningstar.com/ecint/v1/screener";
const FUND_UNIVERSE = "FOIND$$ALL";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

/** Morningstar India fund categories (harvested from the FOIND$$ALL universe). */
export const INDIA_FUND_CATEGORIES: Record<string, string> = {
  "10 yr Government Bond": "INCA000008",
  "Aggressive Allocation": "INCA000043",
  "Alternative Other": "EUCA000881",
  "Arbitrage Fund": "INCA000038",
  "Balanced Allocation": "INCA000012",
  "Banking & PSU": "INCA000065",
  Children: "INCA000070",
  "Conservative Allocation": "INCA000013",
  Contra: "INCA000057",
  "Corporate Bond": "INCA000064",
  "Credit Risk": "INCA000050",
  "Dividend Yield": "INCA000058",
  "Dynamic Asset Allocation": "INCA000044",
  "Dynamic Bond": "INCA000053",
  "ELSS (Tax Savings)": "INCA000033",
  "Equity - Consumption": "INCA000072",
  "Equity - ESG": "INCA000076",
  "Equity - Infrastructure": "INCA000051",
  "Equity - Other": "INCA000031",
  "Equity Ex-Top 100 Long-Short Fund": "INCA000080",
  "Equity Long-Short Fund": "INCA000079",
  "Equity Savings": "INCA000068",
  "Flexi Cap": "INCA000077",
  "Floating Rate": "INCA000066",
  "Focused Fund": "INCA000059",
  "Fund of Funds": "INCA000071",
  "Global - Other": "INCA000037",
  "Government Bond": "INCA000009",
  "Hybrid Long-Short Fund": "INCA000085",
  "Index Funds": "INCA000060",
  "Index Funds - Fixed Income": "INCA000078",
  "Large & Mid-Cap": "INCA000055",
  "Large-Cap": "INCA000001",
  Liquid: "INCA000011",
  "Long Duration": "INCA000042",
  "Low Duration": "INCA000061",
  "Medium Duration": "INCA000063",
  "Medium to Long Duration": "INCA000034",
  "Mid-Cap": "INCA000002",
  "Money Market": "INCA000062",
  "Multi Asset Allocation": "INCA000052",
  "Multi-Cap": "INCA000048",
  "Other Bond": "INCA000046",
  Overnight: "INCA000067",
  Retirement: "INCA000069",
  "Sector - Energy": "INCA000029",
  "Sector - FMCG": "INCA000028",
  "Sector - Financial Services": "INCA000030",
  "Sector - Healthcare": "INCA000003",
  "Sector - Precious Metals": "INCA000032",
  "Sector - Technology": "INCA000004",
  "Short Duration": "INCA000006",
  "Small-Cap": "INCA000054",
  "Ultra Short Duration": "INCA000007",
  Value: "INCA000056",
};

const CATEGORY_NAME_BY_ID = Object.fromEntries(
  Object.entries(INDIA_FUND_CATEGORIES).map(([name, id]) => [id, name])
);

/** Screenable fields exposed to callers, mapped to Morningstar data points. */
const FIELD_MAP: Record<string, { dataPoint: string }> = {
  fundSize: { dataPoint: "fundTNAV" },
  nav: { dataPoint: "closePrice" },
  expenseRatio: { dataPoint: "expenseRatio" },
  starRating: { dataPoint: "starRatingM255" },
  riskRating: { dataPoint: "morningstarRiskM255" },
  yield1Y: { dataPoint: "yield_M12" },
  managerTenure: { dataPoint: "managerTenure" },
  category: { dataPoint: "categoryId" },
  returnYTD: { dataPoint: "gbrReturnM0" },
  return1D: { dataPoint: "gbrReturnD1" },
  return1W: { dataPoint: "gbrReturnW1" },
  return1M: { dataPoint: "gbrReturnM1" },
  return3M: { dataPoint: "gbrReturnM3" },
  return6M: { dataPoint: "gbrReturnM6" },
  return1Y: { dataPoint: "gbrReturnM12" },
  return3Y: { dataPoint: "gbrReturnM36" },
  return5Y: { dataPoint: "gbrReturnM60" },
  return10Y: { dataPoint: "gbrReturnM120" },
};

export const INDIA_FUND_SCREENER_FIELDS = Object.keys(FIELD_MAP);

const RESULT_DATA_POINTS = [
  "secId",
  "name",
  "categoryId",
  "categoryName",
  "closePrice",
  "priceCurrency",
  "fundTNAV",
  "expenseRatio",
  "starRatingM255",
  "morningstarRiskM255",
  "yield_M12",
  "inceptionDate",
  "managerTenure",
  "gbrReturnM0",
  "gbrReturnD1",
  "gbrReturnW1",
  "gbrReturnM1",
  "gbrReturnM3",
  "gbrReturnM6",
  "gbrReturnM12",
  "gbrReturnM36",
  "gbrReturnM60",
  "gbrReturnM120",
].join(",");

export interface IndiaFundScreenerFilter {
  field: string;
  operator: "GT" | "LT" | "BTW" | "IN";
  values: (string | number)[];
}

export interface IndiaFundScreenerParams {
  filters?: IndiaFundScreenerFilter[];
  /** Free-text match on fund name. */
  term?: string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

interface RawScreenerRow {
  secId: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  inceptionDate?: string;
  priceCurrency?: string;
  [key: string]: string | number | undefined;
}

interface RawScreenerResponse {
  total: number;
  page: number;
  pageSize: number;
  rows: RawScreenerRow[];
}

export interface IndiaFundScreenerRow {
  name: string;
  secId: string;
  category?: string;
  nav?: number;
  currency?: string;
  /** Total net assets in INR */
  fundSize?: number;
  expenseRatio?: number;
  starRating?: number;
  riskRating?: number;
  yield1Y?: number;
  inceptionDate?: string;
  managerTenure?: number;
  returnYTD?: number;
  return1D?: number;
  return1W?: number;
  return1M?: number;
  return3M?: number;
  return6M?: number;
  return1Y?: number;
  return3Y?: number;
  return5Y?: number;
  return10Y?: number;
}

export interface IndiaFundScreenerResult {
  total: number;
  page: number;
  pageSize: number;
  rows: IndiaFundScreenerRow[];
  criteria: {
    filters: string;
    sortOrder: string;
    term?: string;
  };
}

/** Token refresh margin before the JWT `exp` claim. */
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60_000;

export class IndiaFundScreenerService {
  private token: string | null = null;
  private tokenExpiresAt = 0;

  private async getToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    const response = await fetch(QUICKRANK_URL, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to load Morningstar India quickrank page: HTTP ${response.status}`
      );
    }

    const html = await response.text();
    const token = html.match(/id="hfApiToken"\s+value="([^"]+)"/)?.[1];
    if (!token) {
      throw new Error(
        "Could not find API token on Morningstar India quickrank page"
      );
    }

    this.token = token;
    this.tokenExpiresAt = this.parseExpiry(token);
    log.info("Refreshed Morningstar India API token", {
      expiresAt: new Date(this.tokenExpiresAt).toISOString(),
    });
    return token;
  }

  private parseExpiry(token: string): number {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1] ?? "", "base64").toString("utf-8")
      ) as { exp?: number };
      if (payload.exp) {
        return payload.exp * 1000 - TOKEN_EXPIRY_MARGIN_MS;
      }
    } catch {
      // fall through to fixed lifetime
    }
    return Date.now() + 30 * 60_000;
  }

  private buildFilters(filters: IndiaFundScreenerFilter[]): string {
    return filters
      .map(filter => {
        const mapping = FIELD_MAP[filter.field];
        if (!mapping) {
          throw new Error(
            `Unknown field "${filter.field}". Valid fields: ${INDIA_FUND_SCREENER_FIELDS.join(", ")}`
          );
        }
        if (filter.values.length === 0) {
          throw new Error(`Filter on "${filter.field}" has no values`);
        }
        if (filter.operator === "BTW" && filter.values.length !== 2) {
          throw new Error(
            `BTW filter on "${filter.field}" requires exactly [min, max]`
          );
        }

        let values = filter.values;
        if (filter.field === "category") {
          values = values.map(value => {
            const id = INDIA_FUND_CATEGORIES[String(value)];
            if (!id) {
              throw new Error(
                `Unknown category "${value}". Valid categories: ${Object.keys(INDIA_FUND_CATEGORIES).join(", ")}`
              );
            }
            return id;
          });
        }

        return `${mapping.dataPoint}:${filter.operator}:${values.join(":")}`;
      })
      .join("|");
  }

  private formatRow(raw: RawScreenerRow): IndiaFundScreenerRow {
    const num = (key: string): number | undefined => {
      const value = raw[key];
      return typeof value === "number" ? value : undefined;
    };

    return {
      name: raw.name,
      secId: raw.secId,
      category: raw.categoryId
        ? (CATEGORY_NAME_BY_ID[raw.categoryId] ?? raw.categoryName)
        : raw.categoryName,
      nav: num("closePrice"),
      currency:
        typeof raw.priceCurrency === "string" ? raw.priceCurrency : undefined,
      fundSize: num("fundTNAV"),
      expenseRatio: num("expenseRatio"),
      starRating: num("starRatingM255"),
      riskRating: num("morningstarRiskM255"),
      yield1Y: num("yield_M12"),
      inceptionDate: raw.inceptionDate,
      managerTenure: num("managerTenure"),
      returnYTD: num("gbrReturnM0"),
      return1D: num("gbrReturnD1"),
      return1W: num("gbrReturnW1"),
      return1M: num("gbrReturnM1"),
      return3M: num("gbrReturnM3"),
      return6M: num("gbrReturnM6"),
      return1Y: num("gbrReturnM12"),
      return3Y: num("gbrReturnM36"),
      return5Y: num("gbrReturnM60"),
      return10Y: num("gbrReturnM120"),
    };
  }

  async runScreener(
    params: IndiaFundScreenerParams = {}
  ): Promise<IndiaFundScreenerResult> {
    const {
      filters = [],
      term,
      sortField = "fundSize",
      sortOrder = "desc",
      page = 1,
      pageSize = 25,
    } = params;

    if (pageSize > 100) {
      throw new Error("pageSize is limited to 100, reduce pageSize parameter");
    }

    const sortMapping = FIELD_MAP[sortField];
    if (!sortMapping) {
      throw new Error(
        `Unknown sortField "${sortField}". Valid fields: ${INDIA_FUND_SCREENER_FIELDS.join(", ")}`
      );
    }

    const filterString = this.buildFilters(filters);

    const search = new URLSearchParams({
      languageId: "en-IN",
      currencyId: "BAS",
      universeIds: FUND_UNIVERSE,
      outputType: "json",
      version: "1",
      page: String(page),
      pageSize: String(pageSize),
      sortOrder: `${sortMapping.dataPoint} ${sortOrder}`,
      securityDataPoints: RESULT_DATA_POINTS,
      term: term ?? "",
    });
    if (filterString) {
      search.set("filters", filterString);
    }
    const url = `${SCREENER_URL}?${search.toString()}`;

    const request = async (token: string): Promise<Response> =>
      fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "User-Agent": USER_AGENT,
          Origin: "https://www.morningstar.in",
          Referer: "https://www.morningstar.in/",
        },
      });

    let response = await request(await this.getToken());
    if (response.status === 401 || response.status === 403) {
      response = await request(await this.getToken(true));
    }
    if (!response.ok) {
      throw new Error(
        `Morningstar India screener API error: HTTP ${response.status}`
      );
    }

    const data = (await response.json()) as RawScreenerResponse;

    return {
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
      rows: (data.rows ?? []).map(row => this.formatRow(row)),
      criteria: {
        filters: filterString || "none",
        sortOrder: `${sortField} ${sortOrder}`,
        ...(term ? { term } : {}),
      },
    };
  }
}

export const indiaFundScreenerService = new IndiaFundScreenerService();
