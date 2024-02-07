import { createServer } from "node:net";
import type { AddressInfo, Socket } from "node:net";
import { SocketCloseCode, SocketOpCode, encodeVarInt, resolveAddress } from "./src/Socket";
import { Client } from "./src/Client";
import { createHash } from "node:crypto";

if (process.argv[2] === "proxy") {
    const receptionPort = parseInt(process.argv[3] ?? "25565");
    const controlPort = parseInt(process.argv[4] ?? "12343");
    let controlSocket: Socket | null = null;

    const server = createServer().on("listening", () => {
        const address = server.address() as AddressInfo;

        console.log("SakuraMC - Minecraft Port Transfering Proxy");
        console.log(`ポート ${controlPort} でクライアント接続を待機しています`);
    }).on("connection", async socket => {
        socket.on("error", err => {
            if (err.message.includes("ECONNRESET")) return;
            console.error(err);
        });

        const connectResult = await new Promise<SocketCloseCode>((resolve, reject) =>
            socket.once("data", data => {
                if (data[0] === SocketOpCode.HANDSHAKE) {
                    if (controlSocket === null) {
                        socket.write(Buffer.from([
                            SocketOpCode.HANDSHAKE,
                            SocketCloseCode.OK
                        ]));
                        resolve(SocketCloseCode.OK);
                        return;
                    } else {
                        socket.write(Buffer.from([
                            SocketOpCode.HANDSHAKE,
                            SocketCloseCode.RESERVED
                        ]));
                        socket.end();
                    }
                } else {
                    socket.destroy();
                }
                resolve(SocketCloseCode.UNKNOWN);
            })
        );
        if (connectResult === SocketCloseCode.OK) {
            controlSocket = socket;
            console.log(`${controlSocket.remoteAddress} がプロキシを予約しました`);

            socket.on("close", () => {
                if (controlSocket) {
                    console.log(`${controlSocket.remoteAddress} がプロキシの使用を終了しました`);
                    controlSocket = null;
                }
            });
        }
    }).on("error", err => {
        console.error(err);
    }).listen(controlPort);

    const receptionSocket = createServer().on("listening", () => {
        console.log(`ポート ${receptionPort} で Minecraft 接続を待機しています`);
    }).on("connection", thirdparty => {
        if (controlSocket === null) {
            thirdparty.destroy();
            return;
        }

        const connectionId = `${thirdparty.remoteAddress}:${thirdparty.remotePort}`;
        const connectionIdBuffer = Buffer.concat([Buffer.from([connectionId.length]), Buffer.from(connectionId)]);

        controlSocket.write(Buffer.concat([Buffer.from([SocketOpCode.CONNECT]), connectionIdBuffer]));
        thirdparty.once("close", () => controlSocket?.write(Buffer.concat([Buffer.from([SocketOpCode.DISCONNECT]), connectionIdBuffer])));
        controlSocket.once("close", () => thirdparty.end());

        thirdparty.on("data", data => controlSocket?.write(Buffer.concat([Buffer.from([SocketOpCode.DATA]), connectionIdBuffer, data])));
        controlSocket.on("data", data => {
            if (data[0] === SocketOpCode.DATA) {
                if (data.subarray(2, data[1] + 2).toString() === connectionId) {
                    thirdparty.write(data.subarray(data[1] + 2));
                }
            }
        })

        thirdparty.on("error", err => {
            console.error(err);
        });
    }).on("error", err => {
        console.error(err);
    }).listen(receptionPort);
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
    client.connect();
    client.on("error", (err: Error) => {
        console.error(err);
        process.exit(1);
    })
}