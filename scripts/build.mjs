import { rollup } from "rollup";
import rollupNodeResolve from "@rollup/plugin-node-resolve";
import rollupTypescript from "@rollup/plugin-typescript";

(await rollup({
    input: "./index.ts",
    plugins: [
        rollupNodeResolve(),
        rollupTypescript()
    ]
})).write({
    format: "cjs",
    file: "./dist/index.js"
});
