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
