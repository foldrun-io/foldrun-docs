# ADR: a coding API and tools for people who code with their own agent

Written 2026-11-09, from the owner's decision in cloudhost.ir (D233, `docs/decisions.md`
there; its request to us is `docs/foldrun-coding-api-brief.md`). Sequels
[[paas-adr]]: that said what becomes a database; this says what foldrun offers
people who want to code, not only run agents.

## The decision

Technical people should code with foldrun directly, with whichever coding agent
they already use, and optionally push the result to cloudhost.ir. Non-technical
people use the chat inside cloudhost, which already runs on our run API; that
does not change. Cloudhost builds no coding CLI, no editor extension, no harness
and no LLM proxy of its own: all of that is ours to offer, once, for everyone.

We offer three things, in this order. Each stands alone and the first is the
cheapest, so stop after any of them if nobody asks for the next.

1. **A gateway any coding agent can use.**
   - An Anthropic-style endpoint (Claude Code, and any tool that takes an
     Anthropic base URL and key) and an OpenAI-style endpoint (Cline, Roo Code,
     Kilo Code, Continue, Codex, Copilot bring-your-own-key, Cursor).
   - One key per customer, a spending limit per key, usage per key, all charged
     through the metered model gateway we already have (`model-gateway.ts`).
   - Anthropic models behind the Anthropic format need no translation. Other
     models (OpenAI, Gemini, DeepSeek, Kimi) need tool-call and streaming
     translation; if that proves weak, advertise Anthropic models for Claude
     Code and the others for the OpenAI-style endpoint.
2. **The runner as a tool.** "Run this in a sandbox" and "run these N subagents
   in parallel", over MCP (see [[mcp]]), so any agent can use our sandboxes and
   pods instead of the laptop's memory. One 14-worker test run already
   exhausted a laptop, which is the reason this exists.
3. **Our own CLI and VS Code extension**, with a per-session choice:
   - **on this computer**: the engine without our screen, tools and subagents as
     local processes in the open folder, capped by free memory, only model
     calls leaving the machine;
   - **on our runner**: a sandbox per subagent (`sandbox: own`), the result as a
     diff the person accepts into the folder.
   The local part is a package of the engine alone: no web UI, no CLI texts, no
   branding beyond the licence file.

## What cloudhost does with it

- Its chat keeps calling our run API and never names foldrun to its customers.
- A docs page there, "Use your own coding agent", sends technical people here
  and shows how to push to cloudhost with a project key through its MCP server
  and API.
- Cloudhost pays us in dollars and charges in toman (its D192 cost).

## Rejected

- A coding CLI and extension in cloudhost for now: months of work that belongs
  here once, for everyone.
- Only Claude Code on our API with nothing of our own: it cannot run subagents
  in sandboxes in the cloud, and that is the part nobody else offers. So it is
  step 1, not the whole plan.

## Cost

- A gateway means translating and supporting two wire formats, and keeping
  step with Claude Code and the others as they change.
- The local package is a second thing to version, test and ship; the licence is
  FSL-1.1-ALv2 and the owner's own, so cloudhost needs a written commercial
  grant before it ships anything of ours inside its product (not needed if
  people simply install foldrun themselves).

## To check, before step 1 is promised to anyone

- Each editor tool's exact setting for a custom endpoint. The list above was
  written from memory, not checked against their docs.
- Whether cloudhost later wants its own address in front of the gateway; only
  if its customers ask.

## Step 1 design (10 Nov 2026, owner's answers)

Read from the code before writing any: the metering is `admitCall` in
`foldrun-platform/src/model-gateway.ts` (route rule, standing, balance, price,
held estimate, usage read from the stream), called today only by the egress
proxy for a run's sandbox. The platform's Anthropic key is opened only in that
process (`model-keys.ts supplyKey`); the web app only knows whether one is set.

Decisions:

- **Runs in the egress service, not in Next.** A new public listener there
  serves `POST /v1/messages`, `POST /v1/messages/count_tokens` and
  `GET /v1/models` (what Claude Code calls under `ANTHROPIC_BASE_URL`). It
  reads the key from `x-api-key` or `Authorization: Bearer`, then runs
  `admitCall` and forwards to api.anthropic.com with the platform key, so the
  key never leaves that process. foldrun-infra routes a hostname to it.
- **A new key purpose, `gateway`**, beside `a2a` (`api_keys.purpose`, plus a
  nullable `gateway` jsonb grant: `{ capUsd, dailyUsd }`; expand-only
  migration). It opens `/v1/*` on the gateway and no `/api` route
  (`resolveTenant` refuses it, as for `a2a`); minted by an admin with
  `POST /api/keys { purpose: "gateway", capUsd?, dailyUsd? }`.
- **Limits:** the per-key cap is checked on top of the account balance and the
  daily supply limit; usage rows carry `kind: "coding"` and the key id, so
  usage is listed per key.
- **Anthropic models only in v1** (no translation), as the ADR said.
- **Layers still owed after the API:** dashboard (Settings → API keys: mint a
  gateway key, show the base URL and usage), CLI (`foldrun keys create
  --gateway`, `foldrun keys usage`), `api.md`, a docs page "Use Claude Code
  with foldrun", `openapi.ts`, surface-coverage entries.
- **Hostname:** a path on the public host, `https://dev.foldrun.io/gateway`
  (foldrun-infra public-ingress), so no new certificate or DNS name.
- **Not for Iranian customers** (owner, 10 Nov 2026): foldrun does not sell
  to them, so Anthropic's terms for Iran and toman payment are not
  questions for this plan.

## Shipped in step 1 (10 Nov 2026, live on dev v2026.11.09.3)

The gateway door (`foldrun-platform/src/gateway-door.ts`) on the egress pods
behind `https://dev.foldrun.io/gateway`; gateway keys (`purpose: "gateway"`)
on foldrun's models with per-key limits in dollars charged, each call kept at
its own margin (`model_usage.margin`); login keys (`credential: "login"`) on
the operator's own Claude login for the operator's own accounts. Proven with
real Claude Code on dev on a login key. Not proven on dev: a metered key
against real providers (dev has foldrun's models off and no provider keys).

## Plan: a gateway that scales, every model behind one key, subagents on foldrun's pods (10 Nov 2026)

The owner's asks, in one plan:
1. The LLM gateway scales.
2. One foldrun key reaches any provider's models, chosen by the caller.
3. Claude Code on a laptop hands work to agents in foldrun's pods and gets
   their answers back. That works from the HTTP API, MCP and the CLI alike.

Claude Code and the Agent SDK are not changed. Everything is server-side,
reached the ways Claude Code already supports: an Anthropic base URL, and
MCP.

Not in this plan: foldrun signing in to several consumer subscriptions and
serving them to customers. That resells consumer plans, which the providers'
terms forbid (cloudhost's D152 reached the same conclusion), and it risks
the subscription the desks run on. Customers get foldrun's models on API
keys, resold at margin, which is allowed, and may connect their own keys.

Checked before writing:
- **Industry gateways** keep the database off the per-call path.
  - LiteLLM batches spend writes (60 s; a Redis buffer above ~1k rps).
  - Envoy AI Gateway runs a stateless proxy with a Redis rate-limit service.
  - Cloudflare, Portkey and Helicone enforce budgets and rate limits from
    shared fast state.
- **cloudhost's own proxy design (D152)** is stateless, keeps limits in
  memory and meters in batches.
- **Codex's design debate** made 15 points. The large ones were checked in
  the code and are folded in below, marked (C).

### Part S — the gateway scales (first: everything else stands on it)

Until 10 Nov 2026 each call made 4–6 Postgres queries. One advisory lock per
account serialized every model call of that account, runs included, and the
spend sums grew with history (fixed by the counter rows below).
`model_usage` has no index on `job`, and the gateway
shares the run proxy's egress pods.

- **S1. Its own image and Deployment (owner, 10 Nov 2026).**
  - **Image:** a slim `foldrun-gateway` image built from the same repos as a
    separate target of the existing Dockerfile. It holds Node and the
    gateway's modules only: less to attack on a public door, and faster to
    pull when the HPA adds pods. A guard test fails when the gateway imports
    something the image lacks.
  - **Pipeline:** built, scanned, published and pinned by the same pipeline
    (`images.sh`), so it is always the same version as the rest.
  - **Entry point:** `src/gateway.ts`, as `src/egress.ts` is for the proxy.
  - Stateless, at least 2 replicas, with an HPA on CPU and open streams.
  - Drained on SIGTERM.
  - The `foldrun-gateway` Service and nginx `/gateway/` point at it.
  - Runs and coding traffic can no longer starve each other.
  - Language stays TypeScript. The work is network-bound, and a rewrite
    would duplicate the metering, price rules and translator that runs use.
    Load-test before reconsidering.
- **S2. Spend, limits and rate limits in Redis.** One atomic script per call
  holds the estimate against:
  - the account's day,
  - the key's cap and day,
  - the key's requests per minute,
  - the account's wallet hold.

  The script refuses with which limit has no room. Closing a call adjusts
  each counter by actual minus estimate. No Postgres lock.
- **S3. Wallet holds in chunks (C: today admission only checks balance > 0).**
  - The gateway takes credit from the wallet into Redis a chunk at a time,
    and returns the unused part. Calls hold against that chunk.
  - Postgres is written once per chunk, never per call.
  - Overspend is impossible however many calls run at once.
  - Run compute uses the same holds.
- **S4. Usage rows in batches.** `model_usage` rows are queued and written
  in batches; a crash replays the queue, idempotent by call id. Settlement
  and the ledger are unchanged. Limits never read Postgres sums again, and
  history no longer slows anything.
- **S5. Key lookups cached** for ~10 s per pod. A revocation is published
  on Redis and drops the key at once. "Last used" is written in batches.
- **S6. Measured.** Prometheus counters for streams, held dollars, refusals
  by limit and batch lag. A load test sets each pod's open-stream budget and
  the HPA target from numbers.

**Part S, as built (Codex design debate, 10 Nov 2026, findings checked in the code).**
Redis may be wiped (`cache.ts` allows it), so it is never the only record of
money held. The steps, each shippable alone:

- **(a)** The `(tenant, job, day)` index on `model_usage` (0045), and the
  gateway's duplicate spend pre-check removed: the reservation alone refuses.
  — done.
- **(b)** Its own image (`--target gateway`) and Deployment
  (`components/gateway`), with today's accounting. Pipeline: built, scanned,
  published, reused and pinned like the rest. The egress pods no longer
  serve it. Rollout, drain and rollback exercised. — built.
- **(c)** Cached key lookups (≤ 10 s staleness, expiry checked per call), and
  per-key rate and concurrency limits on every route, login keys included.
- **(d)** Retry-stable call ids, plus durable batched admission and close in
  Postgres behind a flag: a call is sent only after its admission batch
  commits.
- **(e) first attempt — parked (branch `s-e-redis-counters` in
  foldrun-platform, not merged, 10 Nov 2026).** A Lua admission, an
  in-flight set and counters rebuilt from Postgres. Its tests pass, but
  Codex's review found races still open:
  - a rebuild's snapshot against the in-flight handoff;
  - a close delta applied to a counter rebuilt after the row closed;
  - a wipe between hold and insert.

  Superseded by the counter rows below.
- **(e), built in Postgres (10 Nov 2026): running counters.** A table
  `model_spend` holds one row per account and limit: the account's day
  (list price), a gateway key's total and the key's day (charged, cost ×
  margin).
  - **Holding a call** is one conditional `UPDATE … SET usd = usd + hold
    WHERE usd + hold <= cap` per limit. It runs in the same transaction as
    the call's `model_usage` row. There is no lock over the account and no
    sum of the day. Counters are taken in one order, so two calls never
    deadlock.
  - **Closing a call** moves its counters by what it cost minus its hold,
    on the day it was held. It does this in the same transaction as the
    row's close, with the row locked. A row already settled changes nothing.
  - **A missing counter** is filled from the rows already there, in a
    short transaction of its own under a per-account lock, and the hold is
    tried again. So the deploy that adds the table needs no backfill, and a
    fill never waits while holding a counter.
  - **A close that finds no counter** leaves it to the fill. At worst a
    counter made while a call was closing keeps that call's hold: more than
    it cost, never less.
  - **A guard trigger** on `model_usage` (migration 0047) covers any write
    the counting code did not make: the previous release during a rollout
    or after a rollback, or a hand-run fix. Such a write takes the same
    per-account lock and clears that account's counters, and the next call
    fills them again. So a fill and an old-release write cannot miss each
    other.
  - **Codex's review** (five passes) found eight problems, all fixed with
    tests: a first call refused between two reads, a close during the first
    fill, rounding drift, rows from before margins were stored, a hold's
    margin not kept, a refusal dropping a filled counter, rollbacks, and an
    old-release write racing a fill.
  - **Measured** (16 workers, one account, local Postgres):

    | Rows already in the day | Before: calls/s, median | After: calls/s, median |
    |---|---|---|
    | 50,000 | 96, 182 ms | 409, 37 ms |
    | none | 396 | 406, 38 ms |

    History no longer changes the cost of a call.
  - Redis is still the next step if one account outgrows one row's update
    rate.
- **(e), the full design:** Redis counters with tenant hash-tagged keys and
  one validating Lua admission script, plus durable closes on each call's
  original day.
  - When Redis is down, admission is 503 (never `cache.ts`'s local fallback).
  - After a restart, an epoch fence rebuilds from Postgres.
  - Rollout: run in shadow, then switch whole accounts, runs included.
- **(f)** Wallet chunks as billing-owned reservations through `billing()`.
  The posted ledger charge releases the reservation in the same transaction,
  and run admission joins the same money rule.
  - "Overspend impossible" was too strong: the estimate is not a proven
    upper bound, so the guarantee is bounded exposure. A call that runs over
    its estimate is recorded in full, admission stops and an alert fires.

### Part A — the gateway reaches every provider

**Routing.** A provider is chosen by the model name in each request:
`provider/model` always (`openai/gpt-6`), or a bare name with a known
prefix (`claude-`, `gpt-`, `gemini-`, `deepseek-`, `kimi-`). The key's own
mapping (A5) applies first. Proven 10 Nov 2026: Claude Code sends any
`--model` name unchanged (`/v1/messages?beta=true model=openai/gpt-6`).

- **Status (10 Nov 2026):**
  - **A1 and A2 built and proven** with real Claude Code against recording
    fakes, tool loops included. Calls are chosen by model name: DeepSeek and
    Kimi as they are; OpenAI (Responses) and Gemini (Chat Completions)
    through core's translator.
  - **Gemini's thought signatures** are kept per account and per call (2 h)
    in Redis, else in the pod's memory.
  - **Core's Responses translator** now ends a failed or cut-off stream in
    an error.
  - **A5 built and live:** a gateway key's model map, through the API,
    Settings → API keys, `foldrun keys set` and these docs.
  - **Admission on counter rows** (Part S (e), built in Postgres).
  - **Not yet:** A0 (a shared executor for runs too), A3, A4, A6.
- **A0. One provider executor, used by the gateway and the run proxy (C).**
  It resolves the credential, admits, attempts, meters and translates, so
  multiple keys, failover and metering are written once for both paths.
- **A1. Anthropic-format providers (DeepSeek, Kimi).** Requests go to their
  `/anthropic/v1/messages` with `shapeRequest`, as runs do, and are metered
  per provider. No translation.
- **A2. Translated providers (OpenAI Responses, Gemini Chat Completions).**
  Uses core's pure converters and stream translators, not the localhost
  server. Metering reads the provider's own format.
  - Before going public, fix two things (C):
    - an OpenAI `response.failed` becomes an Anthropic error, not a normal
      end;
    - Gemini's thought signatures survive between separate calls, kept in
      authenticated tool-call ids or a tenant-scoped Redis entry, never a
      global cache.
  - Prove, for each model offered, tool discovery and a full multi-turn
    tool loop. Deferred MCP tools are dropped today, which would break
    Part B (C).
  - The docs say what is lost:
    - prompt caching;
    - thinking, where the provider has none;
    - server tools;
    - Claude Code's cost and context display for non-Claude models.
- **A3. Several platform keys per provider, with failover (after S and A0).**
  - Keys gain a slot and a quota group; one expand-only migration that
    keeps old readers working.
  - Refusals are classed as transient rate limits, exhausted quota or dead
    credentials. Cooldowns are kept in Redis, across replicas.
  - A call is retried on a key in another quota group only before any
    output has gone out, within a capped time.
  - One request has several recorded attempts under one held budget, so a
    retried success is never free (C).
- **A4. The account's own provider keys.** Kept in the vault.
  - The account sets the order of sources (own first, or foldrun's first);
    falling back to platform credit is opt-in.
  - The source is recorded per attempt. Own-key tokens are recorded, not
    billed (pod compute still is).
  - Login keys stay Claude-only.
- **A5. Per-key model mapping.** `models: { opus?, sonnet?, haiku? }` in
  the key's grant (no migration). The gateway rewrites the model before
  routing, so the `/model` picker reaches any provider with no client
  settings.
  - Only priced, offered models are accepted, resolved through one catalog.
  - API: set at mint, and by a PATCH on the key.
  - Dashboard: the key row shows what each tier really runs on.
  - CLI: `foldrun keys set <id> --sonnet openai/gpt-6`, shown in `keys ls`.
- **A6. The other routes.**
  - `/v1/models` lists every priced, offered model.
  - `count_tokens` for a non-Anthropic model returns an estimate, marked as
    one.

### Part B — subagents on foldrun's pods (API first; MCP and CLI over it)

Claude Code's own subagents always run locally; its docs offer
`isolation: worktree` only. MCP is the supported way out, and foldrun
already serves one (`/api/mcp`). Every MCP tool wraps an HTTP route.

- **B1. A job contract, before code (C).**
  - Spawning returns a durable receipt at once. Results are read, never
    waited on over one HTTP request: MCP waits stop at 900 s and buffer
    whole replies.
  - A waiter disconnecting never cancels the job; stop is explicit.
  - Each child has an idempotency token, and a fan-out reports partial
    admission.
- **B2. Isolation by default (C).**
  - A spawned pod gets no account secrets, integrations or workspace
    context unless the request grants them by name.
  - Its network is the intersection of the workspace's list and the
    request's.
  - Uploaded files can never widen what the agent may do.
  - Spawned agents cannot spawn more (no recursion).
- **B3. Code in, as an immutable snapshot.**
  - The CLI (or a small local MCP helper — a remote MCP tool cannot read the
    laptop) packs the folder and uploads it under a narrow `snapshot:write`
    permission, not `workspace:write` (C).
  - Excluded by default: `.env`, credentials, `.git`, dependency and build
    folders.
  - Checks: size, file count and unpacked size limits; digest verified; no
    path traversal, escaping links or special files.
  - Or `{ git: { repo, ref } }` pinned to the resolved commit, with a
    repo-scoped credential.
- **B3 design, debated with Codex (10 Nov 2026). The first slice to build:**
  - **Where it lands:** a separate writable `/snapshot` in the run's sandbox, never under `/workspace`. All of `/workspace` is copied back after a run; nesting would tangle with copy-back, retries and recovery. The original manifest stays outside the agent's reach; the snapshot id is kept with the run, so a replaced worker can rebuild the baseline.
  - **What comes back:** a git-compatible patch against the uploaded working tree, not git HEAD. It covers adds, deletes and the exec bit; renames are a delete plus an add. A change manifest gives each file's operation, before/after hashes and sizes. Binary changes are listed, not patched, in the first slice.
    - A patch is never cut short to fit. If it is too big, the result says so.
    - `result` stays small: answer, summary, completeness, artifact ids.
    - `foldrun run diff <id>` prints the patch; `git apply --check` comes before applying. Later, `foldrun run apply` checks the baseline hashes itself.
  - **Packing:** `git ls-files -z --cached --others --exclude-standard`, limited to the chosen folder; tracked files already deleted locally are skipped. Name exclusions (`.env*`, keys, credentials) apply to tracked files too. The archive is deterministic, for dedup.
  - **Secrets:** core's scanner runs in an upload mode that repo comments cannot silence, on the exact bytes being packed. A finding refuses the upload; an explicit local override is the only way past. Files it cannot scan are reported. The local MCP tool reads only configured roots.
  - **Upload:** `POST /api/workspaces/<ws>/snapshots` under a new `snapshot:write` permission (editor has it). Auth and the quota reservation come before the body is read.
    - Limits: compressed 50 MB, unpacked 200 MB, 20k files, per-file size, path length and depth.
    - Refused: absolute or `..` paths, links, devices, sparse entries, duplicates and file/directory clashes. Names are checked after PAX overrides.
    - It is extracted fresh, normalised and hash-verified before it is published.
  - **Storage:** records scoped to account and workspace; blobs in the tenant's content-addressed store. An id grants nothing. Unattached snapshots expire after 7 days; those attached to a run are pinned with its results; there are account quotas. GC is wired into the blob sweep.
  - **Idempotency:** the upload and the run each take their own idempotency key, so a deduplicated upload can never start two paid runs.
  - **The first slice:** git folders only, one snapshot per run, text patches. `run_agent` and `agent run` take `snapshot`; the local MCP gets `run_agent_on_folder`.
- **B4. Spawn and results.**
  - `POST /api/workspaces/<ws>/spawn { task | tasks[], agent?, model?,
    size?, snapshot | git, grants? }` returns run ids.
  - `GET …/runs/<id>/result` → `{ status, answer, artifacts: [{ id, kind:
    "patch", digest, baseline }], cost }`.
  - The patch is made outside the agent's control: the final tree against
    the immutable baseline, including new, deleted and binary files.
  - Results are stored artifacts with a digest, never inline text; MCP cuts
    replies at 100,000 characters (C).
  - The default agent is a built-in coding agent that the account can
    override with its own.
- **B5. Limits.** For each fan-out:
  - its spend, from S3's holds;
  - the number of children;
  - queue length and TTL;
  - runtime, disk and output size.

  Pod concurrency is held by room-wait as today.
- **B6. MCP tools:**
  - `spawn_agent`, `spawn_agents` and `agent_result` (with a short bounded
    poll, a cursor and a retry hint);
  - status, message and stop use the existing run routes.
- **B7. CLI.** `foldrun spawn "<task>" [--code .|--git repo@ref] [--model m]
  [--size s] [--wait] [--apply]`. `--apply` verifies the baseline and
  applies the patch in a separate local worktree. `--tasks file` fans out.
- **B8. Claude Code wiring.** `foldrun guide` (and `init`) writes
  `.claude/agents/foldrun.md`, a subagent whose `mcpServers:` names
  foldrun's MCP and whose prompt says when to hand work over. The docs give
  the one `claude mcp add --transport http foldrun …` line.
- **B9. Dashboard.** Spawned runs are marked on the Runs page, with the
  patch to view and download and their pod cost.

### Order, and how each part ships

1. **S1–S6.** The gateway scales.
2. **A0 → A1 → A2 → A5 → A6.** Every provider, one key.
3. **B, as one slice.** The job contract, isolation, snapshot upload,
   spawn, result, download and stop. Then MCP and the Claude Code wiring,
   then fan-out and the dashboard.

   B can run in parallel with A, because its pods' agents use the platform's
   model supply already.
4. **A3, then A4.** Once attempt accounting and source policy are in place.

Each part ships the same way:
- a Codex design debate first;
- API → dashboard → CLI → docs;
- tests with fake providers, plus real Claude Code on the test VM
  (`ssh foldrun-cc`);
- Codex review until clean;
- the owner sees UI before a push;
- the manual deploy recipe.

Proving real providers on dev needs the operator:
- provider keys in the console;
- their price list entries;
- `models.supply.enabled`;
- an account allowed foldrun's models.

Until then the proof is real Claude Code against recording fakes.

Risks:
- Non-Claude models may do noticeably worse in long agentic sessions.
- DeepSeek keeps data in China (its privacy policy).
- Providers' rate limits reach the caller.
- Dev is one small node: autoscaling only fills it, and real scale needs
  the prod cluster's autoscaling nodes.
