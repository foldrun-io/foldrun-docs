# Every kind of OAuth: what foldrun supports, and the rest in order

*Proposal, 2026-11-01. Status: planned, nothing built. One part per session,
in the order below. Each ships through every layer (API → dashboard → CLI →
docs → tests → Codex review → commit and push, suites on the box) before the
next starts. Mark a part done in the table at the end when it ships.*

Source: the owner's course *Authentication, from first principles*
(`~/Desktop/Authentication-Course.pdf`, Modules 5–7), checked against the code
on 1 Nov 2026. RFC 9700 (OAuth security BCP, Jan 2025) and the OAuth 2.1 draft
are the rules every part follows.

foldrun meets OAuth in three roles. "Supports any kind of OAuth" means
something different in each:

| Role | Where it lives | What it is |
|---|---|---|
| **Client** — an agent reaches Google, Slack, Notion, a bank | core `src/secrets.ts` (`oauth2`, `service-account`, `client-cert`, `identity` kinds, `exchange()`), platform `src/oauth-connect.ts` (consent, code exchange), `src/oauth-clients.ts` (saved clients) | foldrun holds the token and refreshes it |
| **Authorization server** — an AI app signs in to `/api/mcp` | web `server/mcp-oauth.ts`, `app/api/mcp/oauth/*`, `app/(auth)/mcp/authorize` | foldrun issues the token (shipped 1 Nov 2026) |
| **Sign-in** — a person signs in to foldrun | web `server/users.ts`, `app/(auth)/login` | password + MFA only |

## Where it stands

| Kind (course §) | Client | Authorization server (MCP) |
|---|---|---|
| Authorization Code + PKCE S256 (§5.5) | ✅ `foldrun connect` | ✅ |
| Refresh, rotation (§5.8) | ✅ (a rotated refresh token is stored) | ✅ rotation + reuse revokes the grant |
| Client Credentials (§5.6) | ✅ `grant_type: client_credentials` | ✅ machine clients (part G) |
| Device Authorization (§5.7) | ✅ (part F) | not needed (the CLI has `foldrun login`) |
| JWT Bearer grant, RFC 7523 (§5.12) | ✅ `service-account` | — |
| Token Exchange, RFC 8693 (§5.12) | ⚠️ cloud STS only, via `identity` — **part I** | — |
| Client auth `client_secret_post` | ✅ (the only way it sends a secret) | ✅ |
| Client auth `client_secret_basic` (§4.2) | ✅ `token_auth: client_secret_basic` (part A) | ✅ |
| Client auth `private_key_jwt` (§4.4) | ✅ (part E) | ✅ (part E) |
| Public client, PKCE only | ✅ | ✅ |
| Metadata discovery, RFC 8414 / OIDC (§5.10, §6.6) | ✅ `--issuer`, Discover (part B) | ✅ serves it |
| Issuer in the redirect, RFC 9207 (mix-up defence) | ✅ checked against the issuer (part B) | ✅ sends `iss` |
| Revocation, RFC 7009 (§5.10) | ✅ on delete and reconnect (part C) | ✅ `/api/mcp/oauth/revoke` (part C) |
| Resource indicators, RFC 8707 | ⚠️ via `extra` | ✅ enforced |
| Dynamic registration / CIMD (§5.12) | n/a (foldrun registers by hand) | ✅ both |
| PAR, RFC 9126 (§5.12) | ✅ used whenever the app has a `par_url` (built with B, ahead of part H) | later |
| DPoP, RFC 9449 (§5.11) | ❌ — **part H** (Bluesky/atproto, Okta DPoP) | later |
| mTLS client auth + bound tokens, RFC 8705 (§5.11) | ⚠️ `client-cert` exists, never used at the token endpoint — **part H** | later |
| RAR `authorization_details` (§5.12) | ✅ through `--authorize-param` (a JSON value) | — |
| CIBA (§5.12) | not planned (no provider an agent needs uses it) | — |
| OIDC sign-in, SAML, SCIM (Modules 6–7) | — | — (the sign-in role: **part J**) |
| Implicit, Password, PKCE `plain`, wildcard redirects (§5.9, §5.13) | 🚫 refused on purpose | 🚫 refused on purpose |

Provider quirks the client must survive (each gets a fixture in part D):
Google wants `access_type=offline` + `prompt=consent` for a refresh token;
Microsoft wants `offline_access` and a tenant in the URL; GitHub answers
form-encoded unless asked for JSON and issues no refresh token unless the app
enables expiry; Slack's user token is nested in `authed_user.access_token`;
Notion requires Basic and returns no `expires_in`; Atlassian and Xero rotate
refresh tokens on every use; Salesforce returns `instance_url` the agent needs;
some providers send `expires_in` as a string.

---

## A. `client_secret_basic`, and the token response everyone actually sends

**Why.** Today every token request (`exchange()` in core, `exchangeAndStore()`
in platform) puts the secret in the form body. RFC 6749 §2.3.1 says servers
MUST support Basic and MAY support the body; Notion, Spotify, Reddit, Zoom
and others take Basic only, so `foldrun connect` to them fails.

**What.**
- `token_auth: "client_secret_post" | "client_secret_basic" | "none"` on
  `OAuth2Config` (core) and `OAuthClientRecord` (platform), default
  `client_secret_post` (unchanged behaviour). Basic encodes
  `urlencode(id):urlencode(secret)` (RFC 6749 §2.3.1) — not plain base64 of
  the raw pair.
- One function in core builds every token request (code, refresh,
  client_credentials) so the three cannot drift.
- Token response reader: nested `authed_user` (Slack), `expires_in` as a
  string, missing `token_type`, form-encoded answers. Keep the raw extra fields
  (`instance_url`) beside the token.
- Surfaces: Connections form select; `foldrun connect --token-auth basic`,
  `foldrun secrets clients add --token-auth`; `secrets.md`, `cli.md`; frontmatter
  untouched.

**Done when.** Tests against a fake token endpoint that refuses a body secret
and accepts Basic (and the reverse); Slack-shaped and string-`expires_in`
responses parse; existing `oauth2` secrets keep refreshing unchanged.

## B. Discovery from an issuer, and the issuer check

**What.**
- `--issuer https://login.example.com` (and an Issuer field on the form):
  fetch `/.well-known/oauth-authorization-server`, else
  `/.well-known/openid-configuration` (path-insertion order per RFC 8414 §3.1),
  through `fetchPublic`; fill `authorize_url`, `token_url`,
  `revocation_endpoint`, supported auth methods (picks part A's method),
  refuse when `code_challenge_methods_supported` lacks `S256` unless
  `--no-pkce`.
- Store `issuer` (the field already exists on `OAuthClientRecord`); on the
  callback, when the server sent `iss` or advertises
  `authorization_response_iss_parameter_supported`, require it to match
  (RFC 9207).

**Done when.** Discovery tests for both paths and a path-ful issuer; a
callback with the wrong `iss` is refused; `--provider` (deprecated) points
people to `--issuer`.

## C. Revocation, both directions

**What.**
- Client: deleting or reconnecting an `oauth2` secret calls the provider's
  revocation endpoint (from B, or `--revoke-url`) for the refresh token, then
  the access token (RFC 7009 §2.1; 200 for unknown is success). Failure is
  reported, never blocks the delete.
- Server: `POST /api/mcp/oauth/revoke` (client-authenticated like the token
  endpoint), `revocation_endpoint` in the metadata; revoking a refresh token
  revokes the grant.

**Done when.** Fake provider records the revoke; MCP revoke ends the
connection; surface-coverage and OpenAPI shapes updated.

## D. The proof: one capability list, a real authorization server, provider fixtures

**What.**
- `foldrun-core/src/oauth-capabilities.ts`: every kind in the table above,
  per role, `supported | planned | refused` with the reason and the test that
  proves it — the same single-source pattern as `frontmatter-fields.ts`. A
  test fails when a `supported` entry names no passing test or no docs row;
  `docs/oauth.md` (new, customer docs) is generated from it.
- An `oauth-conformance` suite that runs the client against **Keycloak** in a
  container on the box CI runner (it implements Basic, `private_key_jwt`,
  device, token exchange, PAR, DPoP and mTLS): one realm, one client per
  variant, consent driven headlessly. Runs before promotion, not on every push
  (test-on-box rule).
- Provider fixtures for every quirk listed above, as recorded responses.
- Keep `tests/mcp-oauth.test.ts` and add the official MCP TypeScript SDK
  end-to-end (the script used on 1 Nov 2026) as a permanent web e2e.

**Done when.** The capability test is green and `docs/oauth.md` lists every
row; the Keycloak suite runs on the box runner and covers every `supported`
client row.

## E. `private_key_jwt`

**What.** Client: `token_auth: "private_key_jwt"` with a key held as a
`client-cert`-style sealed secret (or a generated key pair whose public JWK
`foldrun` prints for the provider), signing a `client_assertion` (RFC 7523 §2.2;
`aud` = token endpoint, `jti`, ≤ 5 min). Server: CIMD and registered clients
may declare `jwks_uri`/`jwks` and authenticate with it.

**Done when.** Keycloak `private_key_jwt` client connects and refreshes; an
assertion with a reused `jti` or wrong `aud` is refused by the MCP server.

## F. Device Authorization for `foldrun connect`

**What.** `foldrun connect NAME --device` (and the Connections form): POST the
device endpoint (from discovery or `--device-url`), show the code and
`verification_uri`, poll at `interval` with `slow_down` handling (RFC 8628),
store the result as an ordinary `oauth2` secret.

**Done when.** Keycloak device client connects end to end; expiry and denial
are reported.

## G. Client Credentials at the MCP server

**What.** An admin registers a machine MCP client in Settings (role, workspaces,
read or act — the same choices a person makes) and gets a client id + secret
(or a `private_key_jwt` key from E); `grant_type=client_credentials` at
`/api/mcp/oauth/token` mints an access token for that grant, no refresh token.
Listed with the connected apps; revocable; audited.

**Done when.** A machine client lists tools and is refused past its role; a
revoked one gets `invalid_client`.

## H. Sender-constrained tokens: DPoP, PAR, mTLS

**What.** Client: DPoP proofs on token and resource requests for providers
that require them (key per secret, `DPoP-Nonce` retry), PAR for the authorize
step, and the existing `client-cert` used at the token endpoint
(`tls_client_auth`) and on the API calls its token is bound to. The egress
proxy must add the DPoP header per request — the proof is per URL and method,
so it cannot be a static header. Server (later): DPoP-bound MCP tokens.

**Done when.** Keycloak DPoP and PAR clients, and an mTLS-bound client, connect
and call a protected endpoint through the egress proxy; atproto (Bluesky)
connects as the real-world check.

## I. Token Exchange as its own secret kind

**What.** `token-exchange` kind (RFC 8693): subject token from another secret
or the workload identity, `requested_token_type`, `audience`, `scope`; cached
like `oauth2`.

**Done when.** Keycloak token exchange issues a narrowed token an agent uses.

## J. People signing in with SSO (its own proposal before building)

OIDC "Sign in with Google / Microsoft / any OIDC provider" per account
(discovery, code + PKCE, ID token validation per course §6.4, `nonce`, JWKS
rotation), then SAML 2.0 and SCIM provisioning (Module 7). Large; write
`proposals/sso.md` first.

---

## Refused, and how it is said

Implicit and Password grants, PKCE `plain`, wildcard or prefix redirect
matching, tokens in query strings: refused with the reason and the RFC, in
`oauth-capabilities.ts` and in the error a person sees — never silently
ignored.

## Status

| Part | Status | Shipped in |
|---|---|---|
| A. Basic + token responses | done 1 Nov 2026 — `token_auth` on oauth2 secrets and saved apps; the agent-facing use of kept `fields` (instance_url) is not built | core cd1bd52, platform bfed11d, web f35c999, CLI + docs (this commit) |
| B. Discovery + `iss` | done 1 Nov 2026 — `--issuer` / Discover, `POST /api/oauth/discover`, `iss_parameter` | this commit set |
| C. Revocation | done 1 Nov 2026 — delete/reconnect revoke at the provider; `POST /api/mcp/oauth/revoke` | this commit set |
| D. Capability list + Keycloak + fixtures | done 1 Nov 2026 — core `oauth-capabilities.ts` → `oauth.md`; `e2e-oauth-keycloak` (Keycloak 26.8.1, gates staging promotion via infra `oauth-conformance.yml`); provider fixtures; MCP SDK test in web | this commit set |
| E. `private_key_jwt` | done 1 Nov 2026 — client (paste or generate a key, Entra cert thumbprints) and MCP server (`jwks`/`jwks_uri`, jti once); proven against Keycloak | this commit set |
| F. Device flow | done 1 Nov 2026 — Connect with a code (dashboard), `foldrun connect --device` (platform or local), PKCE on the device grant; proven against Keycloak | this commit set |
| G. MCP client credentials | done 1 Nov 2026 — machine clients (secret or private_key_jwt) with a standing grant capped by their admin | this commit set |
| H. DPoP, PAR, mTLS | planned | |
| I. Token Exchange | planned | |
| J. SSO for people | needs its own proposal | |
