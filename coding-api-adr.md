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
- Customers' prompts and code go to our servers outside Iran.

## To check, before step 1 is promised to anyone

- Anthropic's terms for customers in Iran using Anthropic models or Claude Code
  through our endpoints. **Not checked; the main risk.**
- Whether customers can pay in toman, through cloudhost's wallet, or only in
  dollars.
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
- **Still open:** Anthropic's terms for Iran (above) before this is promised
  to anyone; the hostname (api.foldrun.io or a path on dev.foldrun.io).
