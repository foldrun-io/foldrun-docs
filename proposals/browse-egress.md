# Every browser under the step's `network:` rule

*Proposal, 2026-11-02. Status: **approved** (owner, 2 Nov 2026: "do the recommendation" — all four decisions as recommended). From Linear FOL-110
(Kousha, e2e on dev). Researched against vendor docs and browser source on
2 Nov 2026 and debated with Codex over three rounds (findings verified against
the code). Each phase ships through every layer (API → dashboard → CLI → docs →
tests → Codex review → commit and push, suites on the box) before the next.*

## The problem

`network:` says which sites a step may reach, and the egress proxy holds it per
request. A step that **browses** is outside it today:

- `runner.ts:2986-2992` gives a browsing step no forward proxy (an October
  incident: in-step Chromium could not send credentials written in a proxy URL).
  Its network is marked not enforced and its run pod is never `filtered`, so
  even `curl` in that step reaches any site.
- The account's browser pod (`playwright run-server --unsafe`, pooled per
  account) reaches the whole internet (`account-pod.ts:285`) and cannot reach
  the proxy (8090 admits only run pods). Launch options come from the client.
- Lightpanda, Obscura and live Chrome run inside the step; vendor browsers
  (Browserbase, Steel, Hyperbrowser, Browserless, Bright Data, ZenRows, any CDP
  URL) browse from the vendor's network.

## What the research settled

- **A proxy setting is never enforcement by itself.** Any CDP client can give a
  new browser context its own proxy (`Target.createBrowserContext {proxyServer}`),
  in Chromium and in Lightpanda; Playwright does exactly this. A proxy holds only
  where the browser's network reaches nothing but the proxy, or where the agent
  never holds the browser connection.
- Chromium ignores credentials in `--proxy-server`; proxy auth is CDP
  `Fetch.authRequired` (what Playwright does). With an HTTP(S) proxy, DNS resolves
  at the proxy and WebSockets use it; UDP (WebRTC, QUIC) cannot.
- Request *interception* (Playwright routes, CDP Fetch) misses service workers and
  more; it is diagnostics, not a boundary. No maintained "CDP firewall" exists.
- Vendors: Browserbase (`browserSettings.proxies` type `external`, trusts our CA
  via `proxySettings.caCertificates`), Steel (`useProxy.server`, also OSS),
  Hyperbrowser (Enterprise only) and Browserless (paid) accept a customer proxy.
  Bright Data and ZenRows document none; their blocking is client-side. Whether
  any vendor sends UDP/WebRTC or falls back direct is unpublished.
- Prior art: Anthropic's sandbox-runtime removes the network namespace and leaves
  only host proxies that enforce the allowlist — the same shape as below.

## Design

**Network confinement for every browser we host; a trusted browse service for
our tool and vendor sessions; refuse what cannot be enforced.**

1. **Hosted browsers (our pod, in-step engines): confinement.** Their network
   reaches only the authenticated egress proxy and DNS — IPv4, IPv6 and UDP
   covered. A client that changes the proxy gets a connection failure, never an
   escape. One browser pod per active lease at first (no shared UID, filesystem
   or network between steps); the server owns launch flags (no `--unsafe`
   client options). In-step engines keep raw CDP inside the confined pod; each
   needs a working proxy adapter (Lightpanda `--http-proxy` +
   `--proxy-bearer-token`; Obscura `--proxy`, to verify) or is not admitted.
2. **A browse service outside the sandbox.** `browse.mjs`'s execution moves to a
   trusted service; the sandbox keeps a compatible CLI shim. The service owns
   sessions, Playwright/CDP connections, launch options, proxy auth, vendor
   credentials and lifecycle. Every action keeps its contract: click/fill/
   navigation/frames are Playwright calls; `eval` runs in the page, never in the
   service; uploads are bytes sent in, downloads/screenshots/PDF/video come back
   as scoped artifacts; live view keeps streaming frames; saved login state is
   restored into a fresh leased session.
3. **Vendors through our proxy.** A public, TLS, lease-authenticated door on the
   egress proxy; sessions created server-side with a catch-all proxy (no
   Browserbase `domainPattern` that leaves sites direct); the agent reaches a
   vendor session only through the browse service; vendor keys never in the
   sandbox. This stops the agent replacing the proxy. It does **not** prove the
   vendor's browser never goes direct, so a vendor is *enforced* only after
   qualification (below); until then it is labelled "proxy configured, not
   enforced".
4. **Three tiers, said in the trace.**
   - *Enforced — hosted:* our network boundary confines the browser.
   - *Enforced — vendor-qualified:* exclusive control + routing verified by our
     own tests, per provider and version.
   - *Not enforced:* Bright Data, ZenRows, unqualified CDP URLs. The owner opts in
     per agent; under a restricted, enforced `network:` it is refused before
     connecting. No runtime fallback.
5. **Qualification of a vendor (repeatable, in CI).** Collectors we run for
   HTTP(S), WS(S), authoritative DNS, STUN/UDP and HTTP/3; a session exercises
   navigation, eval, frames, workers, popups, downloads and new contexts, tries
   proxy changes and second sessions, and meets proxy outages, 407s, denials and
   lease expiry. Any collector hit not seen by the proxy fails it.
6. **One refusal event** from every enforcement point (admission, service,
   proxy, network): run/step/session/action, tier, destination, where, why —
   policy denial, auth failure, unsupported capability and transport failure
   kept apart. A timeout is never reported as a policy refusal.

Not claimed: control over what an *allowed* remote service fetches on its own
servers (the same is true of fetch/crawl vendors), or per-request origin checks
inside a CONNECT tunnel (the destination is checked; MITM sites see each request).

## Phases (each ships without breaking current browsing)

1. **Honest labels and admission.** Capability metadata per browser type; the
   trace says which tier a browse runs in; current behaviour stays, labelled
   *legacy, not enforced*. Refusal advice: add only the one site
   (`network: { allow: [host] }`), never "or set network: open".
2. **The browse service** behind a switch; the existing action suite passes
   through it; gallery copies updated without overwriting customisations.
3. **Hosted enforcement**, per engine: drop the runner exemption; browser pods
   proxy-only with per-lease pods and server-owned launch options; filtered run
   pods reach their browser; egress CA trusted by the browser for secret-bound
   sites; MITM WebSocket upgrades; tunnels closed when a lease ends.
4. **Vendors:** the public proxy door, then each provider qualified on its own.

## Decided (owner, 2 Nov 2026)

1. The browse-service shape: execution leaves the sandbox. Yes.
2. One browser pod per active lease at first. Yes.
3. A public, authenticated door on the egress proxy for vendor browsers. Yes.
4. Bright Data / ZenRows / raw CDP: refused under a restricted, enforced
   `network:`; otherwise opt-in per agent as *not enforced*. Yes.

No new container image: the browse service and per-lease browser pods run on
the full runner image, as the browser pod does today.

## Status

| Phase | Status | Shipped in |
|---|---|---|
| 1. Labels and admission | deployed on dev (v2026.11.02.2, 2 Nov); not yet clicked through — dev moved to AWS and has no account with an agent yet | core d684047, web 6f7f5fe, cli b215e07, docs 0ca9f0e |
| 2. Browse service | planned | |
| 3. Hosted enforcement | planned | |
| 4. Vendors | planned | |
