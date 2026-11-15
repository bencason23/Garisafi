const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const outputDirectory = path.join(projectRoot, "dist");
const publicFiles = [
  "index.html",
  "sell.html",
  "sell-part.html",
  "car.html",
  "parts.html",
  "part.html",
  "inbox.html",
  "admin.html",
  "login.html",
  "register.html",
  "styles.css",
  "app.js",
  "car.js",
  "parts.js",
  "part-detail.js",
  "part-sell.js",
  "inbox.js",
  "admin.js",
  "admin.css",
  "auth.js",
  "site-menu.js",
  "toast.js",
  "search-analytics.js"
];

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });

for (const file of publicFiles) {
  fs.copyFileSync(path.join(projectRoot, file), path.join(outputDirectory, file));
}

require("esbuild").buildSync({
  entryPoints: [path.join(__dirname, "blob-upload-client.js")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  outfile: path.join(projectRoot, "blob-upload.js")
});
fs.copyFileSync(path.join(projectRoot, "blob-upload.js"), path.join(outputDirectory, "blob-upload.js"));

console.log(`Prepared ${publicFiles.length + 1} public files in dist.`);
