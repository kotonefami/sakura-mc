import { resolveAddress } from "./src/Socket";
import { Client } from "./src/Client";
import { Proxy } from "./src/Proxy";

if (process.argv[2] === "proxy") {
    const controlPort = parseInt(process.argv[4] ?? "12343");
    const receptionPort = parseInt(process.argv[3] ?? "25565");

    const proxy = new Proxy(controlPort, receptionPort);
} else if (process.argv[2] === "client") {
    const destination = resolveAddress(process.argv[3] ?? "");
    if (destination.host === "") {
        console.error("転送先を指定してください。");
        process.exit(1);
    }

    const proxy = resolveAddress(process.argv[4] ?? "");
    if (proxy.host === "") {
        console.error("使用するプロキシを指定してください。");
        process.exit(1);
    }

    const client = new Client(proxy, destination);
    client.on("error", (err: Error) => {
        console.error(err);
        process.exit(1);
    });
}