const fs = module.require("fs");
const p = process.argv[2];
const s = fs.readFileSync(p, "utf8");
const i = s.indexOf(":root{");
let css = s.slice(i, i + 120000);
css = css
  .replace(/\\r\\n/g, "\n")
  .replace(/\\n/g, "\n")
  .replace(/\\t/g, "  ")
  .replace(/\\"/g, '"')
  .replace(/\\'/g, "'");
fs.writeFileSync("docs/prototype/_design-system.css", css);
console.log("bytes", css.length, "lines", css.split("\n").length);
