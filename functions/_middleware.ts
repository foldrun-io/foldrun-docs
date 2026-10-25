// Every request to this Pages project passes through here.
//
// The project answers on its own *.pages.dev address as well as on
// docs.foldrun.io, and search engines treat those as two sites with the same
// content. The production alias redirects to the real domain, permanently,
// so nothing is ever indexed there. Branch previews (anything else under
// .pages.dev) keep serving — that is what they are for — but with a header
// that keeps them out of every index.

const CANONICAL = "docs.foldrun.io";
const PRODUCTION_ALIAS = "foldrun-docs-f24.pages.dev";

// The shape of a Pages Function's context, spelled out here rather than
// pulled from @cloudflare/workers-types: two fields are all this uses.
type Context = { request: Request; next: () => Promise<Response> };

export const onRequest = async ({ request, next }: Context): Promise<Response> => {
  const url = new URL(request.url);
  if (url.hostname === PRODUCTION_ALIAS) {
    url.hostname = CANONICAL;
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }
  const res = await next();
  if (url.hostname.endsWith(".pages.dev")) {
    const out = new Response(res.body, res);
    out.headers.set("X-Robots-Tag", "noindex, nofollow");
    return out;
  }
  return res;
};
