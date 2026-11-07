// The three origins this project links between.
//
// The docs are their own site now — docs.foldrun.io, its own repo, its own
// build — so every link out of them is cross-origin: the marketing pages, the
// app, and back. Hardcoding would mean a staging build advertises production;
// reading the environment means one variable decides and the default is what
// production will be.

export const DOCS_URL = import.meta.env.PUBLIC_DOCS_URL ?? "https://docs.foldrun.io";
export const SITE_URL = import.meta.env.PUBLIC_SITE_URL ?? "https://foldrun.io";
export const APP_URL = import.meta.env.PUBLIC_APP_URL ?? "https://app.foldrun.io";

export const signIn = `${APP_URL}/login`;
export const signUp = `${APP_URL}/signup`;

/** GET <app>/api/signup: whether sign-up is open; buttons marked signup follow it. */
export const SIGNUP_API = `${APP_URL}/api/signup`;
/** The platform's status, for the footer's dot. */
export const STATUS_API = import.meta.env.PUBLIC_STATUS_API ?? "https://dev.foldrun.io/api/status";
export const CONTACT = "hello@foldrun.io";

/** The header: a few doc entry points, then the way back to foldrun.io. */
export const NAV = [
  { href: "/getting-started/", label: "Getting started" },
  { href: "/flows/", label: "Flows" },
  { href: "/cli/", label: "CLI" },
  { href: "/api/", label: "API" },
  { href: SITE_URL, label: "foldrun.io" },
];

export const FOOTER = [
  {
    title: "Docs",
    links: [
      { href: "/getting-started/", label: "Getting started" },
      { href: "/how-it-works/", label: "How it works" },
      { href: "/cli/", label: "CLI reference" },
      { href: "/api/", label: "API reference" },
    ],
  },
  {
    title: "Product",
    links: [
      { href: `${SITE_URL}/features/`, label: "Features" },
      { href: `${SITE_URL}/pricing/`, label: "Pricing" },
      { href: `${SITE_URL}/changelog/`, label: "Changelog" },
      { href: `${SITE_URL}/status/`, label: "Status" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: `${SITE_URL}/about/`, label: "About" },
      { href: `${SITE_URL}/blog/`, label: "Blog" },
      { href: `${SITE_URL}/security/`, label: "Security" },
      { href: `mailto:${CONTACT}`, label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: `${SITE_URL}/privacy/`, label: "Privacy" },
      { href: `${SITE_URL}/terms/`, label: "Terms" },
      { href: `${SITE_URL}/subprocessors/`, label: "Subprocessors" },
    ],
  },
];
