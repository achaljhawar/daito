export default function Home() {
  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>daito</h1>
      <p>
        MCP server exposing Indian stock and mutual fund screener tools at{" "}
        <code>/api/mcp</code>.
      </p>
      <ul>
        <li>
          <code>query_india_screener</code> — Indian stocks via screener.in
          query language
        </li>
        <li>
          <code>get_india_fund_screener</code> — Indian mutual funds via
          Morningstar India
        </li>
      </ul>
    </main>
  );
}
