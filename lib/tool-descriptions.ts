/**
 * @fileoverview MCP tool descriptions for the India screener tools.
 */

export const INDIA_FUND_SCREENER_DESCRIPTION = `Screen Indian mutual funds (~12,700 open-end fund share classes) using Morningstar India data. Filter by category, ratings, expense ratio, AUM, and returns. All monetary values are in INR. Each fund appears once per share class (Direct/Regular × Growth/IDCW) — filter term "Dir Gr" to narrow to direct growth plans.

**OPERATORS** (per filter):
- GT: Greater than [value]
- LT: Less than [value]
- BTW: Between [min, max]
- IN: Match any of [val1, val2, ...] (for category, starRating, riskRating)

Multiple filters are combined with AND.

**AVAILABLE FIELDS** (for filters and sortField):

Size & Cost: fundSize (total net assets, INR), nav (INR), expenseRatio (%)

Ratings: starRating (Morningstar 1-5), riskRating (Morningstar risk 1-5, 5 = highest risk)

Income & Management: yield1Y (%), managerTenure (years)

Returns (%, annualized for multi-year): returnYTD, return1D, return1W, return1M, return3M, return6M, return1Y, return3Y, return5Y, return10Y

Categorical: category (use IN) — equity: Large-Cap, Mid-Cap, Small-Cap, Flexi Cap, Multi-Cap, Large & Mid-Cap, Focused Fund, Value, Contra, Dividend Yield, ELSS (Tax Savings), Index Funds, sector funds (Sector - Technology, Sector - Healthcare, Sector - Energy, Sector - FMCG, Sector - Financial Services, Sector - Precious Metals), Equity - Infrastructure, Equity - Consumption, Equity - ESG; debt: Liquid, Overnight, Money Market, Corporate Bond, Banking & PSU, Credit Risk, Gilt (Government Bond, 10 yr Government Bond), duration funds (Ultra Short/Low/Short/Medium/Medium to Long/Long Duration), Dynamic Bond, Floating Rate; hybrid: Aggressive/Balanced/Conservative Allocation, Dynamic Asset Allocation, Multi Asset Allocation, Equity Savings, Arbitrage Fund; other: Global - Other, Fund of Funds, Retirement, Children

**OTHER PARAMETERS:**
- term: free-text fund name search (e.g. "HDFC Flexi" or "Dir Gr")
- sortField + sortOrder (default fundSize desc), page + pageSize for pagination

**EXAMPLE FILTER SETS:**

1. 5-star flexi cap funds: [{"field":"category","operator":"IN","values":["Flexi Cap"]},{"field":"starRating","operator":"IN","values":[5]}]

2. Cheap large index/large-cap funds: [{"field":"category","operator":"IN","values":["Large-Cap","Index Funds"]},{"field":"expenseRatio","operator":"LT","values":[0.5]},{"field":"fundSize","operator":"GT","values":[10000000000]}]

3. Top long-term performers: [{"field":"return5Y","operator":"GT","values":[20]},{"field":"starRating","operator":"IN","values":[4,5]}]

4. Low-risk ELSS: [{"field":"category","operator":"IN","values":["ELSS (Tax Savings)"]},{"field":"riskRating","operator":"LT","values":[3]}]`;

export const SCREENER_IN_QUERY_DESCRIPTION = `Screen Indian stocks (NSE/BSE) using screener.in's query language. The most powerful India screener — supports 100+ fundamental ratios with annual, quarterly, and multi-year growth variants. Requires SCREENER_IN_EMAIL / SCREENER_IN_PASSWORD env credentials.

**QUERY LANGUAGE:**
Conditions use full ratio names with > < = comparisons, combined with AND / OR. Monetary values are in Rs. Crore (1 Cr = 10 million INR), percentages as plain numbers. Queries are limited to 1500 characters (~40 conditions); there is no separate limit on condition count.

Example: "Market Capitalization > 500 AND Price to earning < 15 AND Return on capital employed > 22"

**COMMON RATIOS** (exact names):
- Size/Price: Market Capitalization (Rs Cr), Current price, High price, Low price
- Valuation: Price to earning, Price to book value, PEG Ratio, Industry PE, Dividend yield, EVEBITDA
- Profitability: Return on capital employed, Return on equity, OPM (operating margin %), NPM last year, Profit after tax
- Growth: Sales growth 3Years, Sales growth 5Years, Profit growth 3Years, Profit growth 5Years, EPS growth 3Years, YOY Quarterly sales growth, YOY Quarterly profit growth
- Balance sheet: Debt to equity, Interest Coverage Ratio, Current ratio, Debt, Reserves
- Quality scores: Piotroski score (0-9), Altman Z Score, G Factor
- Ownership: Promoter holding, FII holding, DII holding, Pledged percentage
- Quarterly: Sales latest quarter, Net Profit latest quarter, OPM latest quarter
- Technical: RSI, Volume, Down from 52w high, Up from 52w low, Return over 1year, Return over 3months

**EXAMPLE QUERIES:**

1. Quality compounders: "Return on capital employed > 20 AND Debt to equity < 0.5 AND Profit growth 5Years > 15"

2. Magic formula value: "Market Capitalization > 1000 AND Price to earning < 15 AND Return on capital employed > 25"

3. Piotroski high scorers near lows: "Piotroski score > 7 AND Down from 52w high > 30"

4. Promoter-backed growth: "Promoter holding > 60 AND Sales growth 3Years > 20 AND Pledged percentage = 0"

Results return whichever columns the query references plus screener.in defaults (price, P/E, market cap, dividend yield, quarterly numbers, ROCE). sortBy takes a full ratio name in lowercase (e.g. "market capitalization").`;
