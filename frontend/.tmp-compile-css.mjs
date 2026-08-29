import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = resolve("src/components/ui/_compile-input.css");
const outputPath = resolve("src/components/ui/styles.css");

const css = readFileSync(inputPath, "utf8");
const result = await postcss([tailwindcss()]).process(css, {
  from: inputPath,
  to: outputPath,
});
writeFileSync(outputPath, result.css);
console.log(`wrote ${outputPath} (${result.css.length} bytes)`);
