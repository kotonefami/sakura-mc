import { join } from "node:path";
import { spawn } from "node:child_process";
import { copyFile, writeFile } from "fs/promises";
import { readFile } from "node:fs/promises";
import { inject } from "postject";

async function command(cmd, args) {
    return new Promise((resolve, reject) => {
        const childProcess = spawn(cmd, args);
        childProcess.stdout.pipe(process.stdout);
        childProcess.stderr.pipe(process.stderr);
        childProcess.once("exit", resolve);
    });
}

(async () => {
    const outputPath = join("dist", process.argv[2]);

    await writeFile("dist/sea-config.json", JSON.stringify({
        main: "dist/index.js",
        output: "dist/sea-prep.blob"
    }));

    await command("node", ["--experimental-sea-config", "dist/sea-config.json"]);

    await copyFile(process.execPath, outputPath);

    await inject(outputPath, "NODE_SEA_BLOB", await readFile("dist/sea-prep.blob"), {
        sentinelFuse: "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
    });
})();