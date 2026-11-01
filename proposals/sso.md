# People signing in with SSO: OIDC, then SAML, then SCIM

*Proposal, 2026-11-01. Status: **on hold** (owner, 1 Nov 2026) — nothing built. Part J of
[oauth-coverage](oauth-coverage.md), which says to write this before building.
One part per session, in order. Each part ships through every layer (API →
dashboard → CLI → docs → tests → Codex review → commit and push, suites on the
box) before the next starts.*

Source: the owner's course *Authentication, from first principles*, Modules
6–7 (§6.4 ID token validation, §6.6 discovery, Module 7 SAML and SCIM),
checked against the code on 1 Nov 2026. The rules every part follows: OpenID
Connect Core 1.0, RFC 9700 (OAuth security BCP), SAML 2.0 Web Browser SSO
Profile, RFC 7643/7644 (SCIM 2.0).

## Where it stands

A person signs in to foldrun with an email and a password, plus TOTP when they
turned it on (`foldrun-web/server/users.ts`, `app/(auth)/login`). One person
belongs to one account. They join an account by invite, at a role (viewer,
editor, admin, owner) and a workspace scope. Sessions are a sealed cookie
(`mintSession`). Nothing reads an outside identity provider.

What companies ask for, in order of how often:

1. "Sign in with Google / Microsoft" for their own staff: **OIDC**.
2. Okta, Entra ID or OneLogin as the one place people sign in, with the
   password turned off: **OIDC or SAML, enforced**.
3. People added and removed in the identity provider show up and disappear in
   foldrun without anyone inviting them: **SCIM**.

## Shape: per account, never per install

SSO is set per **account** (a tenant): Acme's Okta signs Acme's people into
Acme's account, and nobody else's. The hosted install serves many accounts. A
self-hosted one may serve one account, but the shape is the same.

- An account owner adds a **connection**: OIDC (issuer, client id, secret) or
  SAML (IdP metadata URL or XML), plus the **email domains** it is for
  (`acme.com`). A domain is claimed by DNS TXT proof
  (`_foldrun-verify.acme.com TXT foldrun-verify=<token>`) before it routes
  anyone, so one account cannot capture another company's people.
- The login page asks for the email first. A verified domain with a connection
  sends the person to their IdP. Otherwise they get the password form, as today.
- **Enforced** (an owner's switch, per connection): people on that domain can
  no longer sign in with a password, and MFA is the IdP's job. The owner
  always keeps a password plus MFA, so a broken IdP cannot lock the account
  out. That break-glass sign-in is audited.
- **Just-in-time join**: a person the IdP vouches for, on a verified domain,
  with no foldrun user, joins the account at the connection's default role
  (viewer unless the owner chose otherwise) and default workspace scope.
  Off by default. Without it, an invite is still needed.
- An IdP-asserted email is trusted only when `email_verified` is true (OIDC)
  and it is on a verified domain of that connection. Accounts are linked by
  the IdP's stable subject (`iss` + `sub`, or SAML NameID with a persistent
  format), not by email, so a renamed person keeps their history.

## A. OIDC sign-in

**What.**
- `foldrun-platform/src/sso.ts`: connections (`sso_connections` table:
  tenant, kind, issuer, client_id, sealed secret, domains, enforced, jit role
  and scope, created/updated), domain claims (`sso_domains`: domain, tenant,
  token, verifiedAt), and identity links (`sso_identities`: iss, sub, userId).
- Discovery from the issuer, reusing core `oauth-discovery.ts` (part B of the
  OAuth proposal). Authorization code with PKCE S256, `state` bound to a
  browser cookie, `nonce`, `response_mode=query`; `iss` checked when the
  server advertises RFC 9207.
- ID token validation per OIDC Core §3.1.3.7 (course §6.4):
  - the signature with a key from the issuer's `jwks_uri`, cached, refetched
    once on an unknown `kid` (JWKS rotation), RS256/ES256/PS256 only, never
    `none` or HS256 with a public key;
  - `iss` exact; `aud` contains the client id, and `azp` when there are
    several audiences;
  - `exp` and `iat` with 60 s of skew; `nonce` equal to the one sent;
  - `at_hash` when an access token came with it.
- Routes: `GET /api/auth/sso/start?email=` (or `?connection=`), `GET
  /api/auth/sso/callback`, account admin `GET/POST/PATCH/DELETE
  /api/account/sso` and `POST /api/account/sso/domains/<d>/verify`.
- Dashboard: Settings → Sign-in, with the connection form (Issuer + Discover,
  client id, secret, domains with their TXT records and a Verify button,
  enforced, JIT role). The login page is email first.
- CLI: `foldrun account sso` (ls, add `--issuer`, `--domain`, verify, rm,
  `--enforce`). Signing in from the CLI goes through `foldrun login`'s
  browser page, which follows the same email-first login.
- Audit: `sso.connected`, `sso.domain.verified`, `sso.signin`,
  `sso.signin.refused` (with the reason), `sso.breakglass`.

**Done when.** Keycloak (from the OAuth proposal's part D suite) signs a
person in and links them by `sub`. These are refused, each with a test:

- a token signed by another key, or with `alg: none`;
- the wrong `aud`, an expired token, a replayed `nonce`;
- `email_verified: false`;
- an unverified domain.

A rotated JWKS is picked up without a restart. The enforced switch refuses
password sign-in for that domain but not for the owner.

## B. SAML 2.0

**What.**
- SP-initiated Web Browser SSO, HTTP-Redirect binding out, HTTP-POST binding
  back. IdP-initiated is off (no `InResponseTo` to check) unless an owner
  turns it on per connection, with the risk said.
- Response validation:
  - an XML signature over the Assertion (or the Response), with the IdP's
    certificate from its metadata, canonicalised exactly once;
  - no XML signature wrapping: the signed element is the one that is read,
    found by ID reference only;
  - the parser refuses DTDs and entities (no XXE);
  - `Destination`, `Recipient`, `Audience` = our entity ID;
  - `NotBefore` / `NotOnOrAfter` with skew; `InResponseTo` = the request we sent;
  - assertion IDs kept until expiry and refused when seen again.
- SP metadata at `/api/auth/saml/<connection>/metadata`. An encrypted
  assertion is supported when the IdP requires it (a key per connection).
- A maintained library (`@node-saml/node-saml`, pinned), with our own tests
  for every rule above. We do not write the XML signature code ourselves.

**Done when.** Keycloak as a SAML IdP signs a person in. The known SAML
attacks fail, each with a fixture: signature wrapping (XSW1–8), a comment
injected into the NameID, a stripped signature, a replayed assertion, an
expired one, another audience.

## C. SCIM 2.0 provisioning

**What.**
- `/scim/v2/<account>/Users` and `/Groups` (RFC 7644), behind a per-account
  SCIM bearer token minted in Settings → Sign-in. The token is shown once and
  stored by hash, like API keys.
- Users: create (joins the account at the connection's default role and
  scope), replace and patch (`active: false` removes the member and ends their
  sessions, API keys and MCP connections, as removing a member does today),
  delete, and `filter=userName eq "…"`. Identity is the SCIM `externalId` and
  the IdP subject.
- Groups map to a role and a workspace scope ("foldrun-editors-sales" → editor
  on sales), which the owner chooses in Settings. Group membership changes
  move a person's role and scope.
- The owner cannot be deprovisioned by SCIM. That is refused with a
  `scimType` that says why.
- `ServiceProviderConfig`, `Schemas` and `ResourceTypes` endpoints, as
  Okta's and Entra's validators expect.

**Done when.** Okta's SCIM validator (the SPEC tests) and Entra's
provisioning validator pass against stage. A deactivated user's session, key
and MCP token stop at once.

## Not in this proposal

- foldrun as an OIDC provider *for other apps*. foldrun already issues tokens
  for `/api/mcp` (the OAuth proposal), and nothing has asked for more.
- WebAuthn and passkeys for password sign-in: worth its own proposal.
- Per-workspace IdPs: SSO is per account.

## Status

| Part | Status | Shipped in |
|---|---|---|
| A. OIDC sign-in | planned | |
| B. SAML 2.0 | planned | |
| C. SCIM 2.0 | planned | |
