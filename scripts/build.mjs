import { build } from "esbuild";

build({
    entryPoints: ["index.ts"],
    outfile: "dist/index.js",
    platform: "node",
    minify: true,
    bundle: true
})