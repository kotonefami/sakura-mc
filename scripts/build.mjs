import { rollup } from "rollup";
import rollupNodeResolve from "@rollup/plugin-node-resolve";
import rollupTypescript from "@rollup/plugin-typescript";

(await rollup({
    input: process.argv[2] ?? "./index.ts",
    external: [
        "discord.js"
    ],
    plugins: [
        rollupNodeResolve(),
        rollupTypescript()
    ]
})).write({
    format: "cjs",
    file: "./dist/index.js"
});
