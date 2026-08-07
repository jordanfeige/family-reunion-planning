/**
 * Next.js 16.2+ throws E10 ("router state header was sent but could not be
 * parsed") on soft navigations when a stale client sends an older
 * Next-Router-State-Tree shape after a rolling deploy. Upstream PR #92933
 * returns undefined so the request falls back to a full document render —
 * that fix is not in 16.2.6 / 16.3.0 yet. Mirror it until it lands.
 *
 * @see https://github.com/vercel/next.js/issues/92907
 * @see https://github.com/vercel/next.js/pull/92933
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "node_modules", "next");
const NEEDLE = "The router state header was sent but could not be parsed.";

const EXPANDED =
  /throw Object\.defineProperty\(new Error\(['"]The router state header was sent but could not be parsed\.['"]\),\s*["']__NEXT_ERROR_CODE["'],\s*\{\s*value:\s*["']E10["'],\s*enumerable:\s*false,\s*configurable:\s*true\s*\}\);/g;

const MINIFIED =
  /throw Object\.defineProperty\((?:new )?Error\(["']The router state header was sent but could not be parsed\.["']\),["']__NEXT_ERROR_CODE["'],\{value:["']E10["'],enumerable:!1,configurable:!0\}\)/g;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const path = join(dir, name);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(path, out);
    else if (/\.(js|mjs|cjs)$/.test(name)) out.push(path);
  }
  return out;
}

function patchFile(path) {
  const before = readFileSync(path, "utf8");
  if (!before.includes(NEEDLE)) return false;
  if (!before.includes("throw Object.defineProperty")) return false;

  let after = before.replace(EXPANDED, "return undefined;");
  after = after.replace(MINIFIED, "return void 0");
  if (after === before) {
    console.warn(`[patch-next-router-state] pattern miss: ${path}`);
    return false;
  }
  writeFileSync(path, after);
  return true;
}

if (!statSync(ROOT, { throwIfNoEntry: false })?.isDirectory()) {
  console.warn("[patch-next-router-state] next not installed; skip");
  process.exit(0);
}

const files = walk(ROOT);
let patched = 0;
for (const file of files) {
  if (patchFile(file)) {
    patched += 1;
    console.log(`[patch-next-router-state] patched ${file}`);
  }
}

if (patched === 0) {
  // Already patched, or Next changed the throw shape — fail loud so CI notices.
  const stillThrows = files.some((f) => {
    const text = readFileSync(f, "utf8");
    return (
      text.includes(NEEDLE) &&
      /throw Object\.defineProperty\((?:new )?Error\(["']The router state header was sent but could not be parsed/.test(
        text,
      )
    );
  });
  if (stillThrows) {
    console.error(
      "[patch-next-router-state] E10 throw still present but no files patched",
    );
    process.exit(1);
  }
  console.log("[patch-next-router-state] already applied or N/A");
} else {
  console.log(`[patch-next-router-state] patched ${patched} file(s)`);
}
