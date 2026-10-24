// Assemble lib/client.js: inline the stylesheet and the penguin avatar so the
// served browser bundle is self-contained (the module system serves one file).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(root, rel));

const avatar = "data:image/png;base64," + read("assets/qq-avatar.png").toString("base64");
const css = read("src/qq2007.css")
  .toString("utf8")
  .replaceAll("__QQ_AVATAR_URL__", avatar)
  // Raise every rule one attribute-class above harness component rules, which
  // routinely combine two or three classes (e.g. .root[data-phase] .seat).
  .replaceAll("body[data-dsh-qq-skin]", "body[data-dsh-qq-skin][data-dsh-qq-skin]");
const template = read("src/client.js").toString("utf8");

if (!template.includes("__QQ_CSS__") || !template.includes("__QQ_AVATAR__")) {
  throw new Error("src/client.js lost its __QQ_CSS__ / __QQ_AVATAR__ placeholders");
}

const output = template
  .replace("__QQ_CSS__", JSON.stringify(css))
  .replace("__QQ_AVATAR__", JSON.stringify(avatar));

fs.mkdirSync(path.join(root, "lib"), { recursive: true });
fs.writeFileSync(path.join(root, "lib/client.js"), output);
console.log(`lib/client.js written (${output.length} bytes, css ${css.length}, avatar ${avatar.length})`);
