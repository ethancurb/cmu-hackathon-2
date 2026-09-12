# Runtime and CLI validation

Initial validation was performed during planning on September 12, 2026. Implementation checks below extend it with actual application research and rendered design review. These are observed successful runs, not a guarantee of future provider or machine uptime.

## Implementation validation at 06:54 EDT

- Fable 5.1 read three actual rendered screenshots and returned the critique saved in [fable-visual-1.md](../reviews/fable-visual-1.md), with a successful terminal result and no permission denials.
- OpenCode Go GLM-5.3 reviewed the implemented decision engine; its findings and corrections are saved in [domain-code-review.md](../reviews/domain-code-review.md). A later backend source-code export was rejected by automatic approval review, so a native Terra agent independently reviewed and corrected the API instead; see [backend-api-review.md](../reviews/backend-api-review.md).
- The application's Fable WebSearch/WebFetch worker completed a real ten-lead discovery in 70,225 ms. Its output is retained privately under `data/worker/verified-live-discovery.json`; hard rent/layout facts remain unverified until a supported source parser corroborates them.
- The first restricted-environment invocation reported unauthenticated despite normal CLI authentication working. A controlled check isolated missing `USER`/`LOGNAME` identity fields. Preserving those ordinary identity variables allowed the existing Claude.ai Max login to resolve. No credentials were printed or copied into the project, and unrelated environment tokens remain omitted.
- A real three-source HTTP refresh subsequently completed and published `research-20260912104727-b599fa04`, with four pages retrieved and all three public organizations represented. Current app data and final acceptance are tracked in [BUILD-STATUS.md](../BUILD-STATUS.md).

## Capability checks

| Client/version | Canonical model and role | Status and evidence |
| --- | --- | --- |
| Codex 0.154.0 | `gpt-6-astra`; coordinator smoke check | `CODEX_READY` in `codex-check.jsonl`; completed with no recorded permission denials |
| OpenCode 1.18.4 | `opencode-go/gpt-5.6-luna`; inexpensive CLI smoke check | `OPENCODE_READY` in `opencode-check.jsonl` |
| Claude 2.1.258 | `claude-fable-5-1`; canonical smoke check and independent design reviewer | `CLAUDE_READY` in `claude-check.json`; completed with no recorded permission denials |
| Claude/Fable | `claude-fable-5-1`; high-effort frontend/design review | Completed; output is [fable-design.md](../reviews/fable-design.md) |
| OpenCode Go | `opencode-go/glm-5.3`; backend/reliability review | Completed; output is [opencode-backend.md](../reviews/opencode-backend.md) |
| Claude discovery probe | Fable 5.1 with internal Haiku 4.5 WebSearch/WebFetch worker | Completed in `claude-discovery-probe.json`; one direct-manager page was searched and fetched |

Claude initially reported that it was not logged in. The user signed it in; the subsequent authentication state was `loggedIn: true` for Claude.ai Max. Account identifiers and email are intentionally omitted.

The probe reached [Reinhold Residential’s Shadyside Commons page](https://reinholdresidential.com/properties/shadyside-commons/). It returned a candidate at 401 Amberson Avenue with a 2-bedroom/2-bath loft and “From $3405,” while utilities and a CMU walking match were not stated. This proves search/fetch invocation, not trustworthy ingestion. A verification pass found that the probe attached the page’s `09/13/2026` date to the wrong unit: the page’s 2-bed/2-bath Loft 482-0303 showed `09/10/2026`, while `09/13/2026` belonged to 1-bed/1.5-bath Loft 482-0345. The importer must preserve unit-scoped source-table context and reject unvalidated model summaries.

The supplied artifacts also show unrelated GitHub Copilot MCP invalid-token warnings for Codex. They do not invalidate the Codex readiness result, but they mean this evidence must not claim that every integration works. Environment-name checks found no application provider or map API keys. The review packets were transmitted after the user explicitly approved both [fable-design-prompt.md](../reviews/fable-design-prompt.md) and [opencode-backend-prompt.md](../reviews/opencode-backend-prompt.md); the earlier automatic export rejection was resolved and there is no pending approval.

## Safe, reproducible patterns

Use a fresh, dedicated validation directory and capture stdout JSON/JSONL plus stderr separately. Supply only the approved review packets or a one-line readiness prompt; never include private user input or credentials.

```sh
codex exec --ephemeral --model gpt-6-astra --sandbox read-only \
  -c 'model_reasoning_effort="low"' --skip-git-repo-check \
  --cd /private/tmp/hackcmu-cli-validation --json \
  'Respond exactly CODEX_READY. Do not use tools.'

opencode run --pure --agent plan --model opencode-go/gpt-5.6-luna --format json \
  --dir /private/tmp/hackcmu-cli-validation \
  'Respond exactly OPENCODE_READY. Do not use tools.'

claude -p --model claude-fable-5-1 --safe-mode --tools "" --allowedTools "" \
  --permission-mode dontAsk --max-turns 1 --no-session-persistence \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' --output-format json \
  'Respond exactly CLAUDE_READY'
```

For the bounded discovery probe, the recorded Claude pattern retained `--safe-mode`, `--tools WebSearch,WebFetch`, matching `--allowedTools`, `--permission-mode dontAsk`, `--max-turns 6`, `--no-session-persistence`, `--strict-mcp-config`, `--mcp-config '{"mcpServers":{}}'`, and `--output-format json`. The caller enforced a 100-second subprocess timeout. Reviewer runs disabled tools and used only the approved prompt packets. Validate exit status, terminal success, returned marker/text, and `permission_denials` before accepting a result; do not bypass safety flags or retry indefinitely. The `--permission-prompts none` flag in newer online Claude documentation requires 2.1.259 and must not be used on this installed 2.1.258 client.

For unattended work, use finite turn/page/listing limits, hard subprocess timeouts, no session persistence, strict empty MCP configuration unless a named read-only tool is required, timestamped JSONL logs, and bounded retries. Keep logs in the temporary validation directory and redact credentials. A successful invocation is a point-in-time check, not an uptime guarantee.

Any `total_cost_usd` value in these CLI artifacts is an estimated provider list cost for that invocation, not an actual subscription charge. No paid checks should be repeated solely to refresh this record.
