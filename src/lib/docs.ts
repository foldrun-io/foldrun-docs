// The one import of the docs index.
//
// index.ts sits at the root of this repo beside the markdown, and the
// dashboard imports the same file through a tsconfig alias. This hop is
// written once so that if the index moves, one line changes rather than five.

export {
  allDocs,
  groupedDocs,
  docTitle,
  docSummary,
  GROUPS,
  type DocGroup,
} from "../../index.ts";
