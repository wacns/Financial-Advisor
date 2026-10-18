import fs from "node:fs";
const target = "public/ocr";
fs.mkdirSync(target, { recursive: true });
fs.copyFileSync(
  "node_modules/tesseract.js/dist/worker.min.js",
  `${target}/worker.min.js`,
);
for (const name of fs.readdirSync("node_modules/tesseract.js-core"))
  if (/^tesseract-core.*\.(wasm|wasm.js)$/.test(name))
    fs.copyFileSync(
      `node_modules/tesseract.js-core/${name}`,
      `${target}/${name}`,
    );
fs.copyFileSync(
  "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
  `${target}/eng.traineddata.gz`,
);

for (const [source, name] of [
  ["node_modules/tesseract.js/LICENSE.md", "TESSERACT-JS-LICENSE"],
  ["node_modules/tesseract.js-core/LICENSE", "TESSERACT-CORE-LICENSE"],
  ["node_modules/@tesseract.js-data/eng/LICENSE", "ENGLISH-DATA-LICENSE"],
])
  if (fs.existsSync(source)) fs.copyFileSync(source, `${target}/${name}`);

fs.copyFileSync(
  "licenses/TESSDATA-APACHE-2.0.txt",
  `${target}/ENGLISH-DATA-LICENSE`,
);
