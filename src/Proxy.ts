import { createServer, Server, type Socket } from "node:net";
import { EventEmitter } from "node:stream";
import { SocketCloseCode, SocketOpCode } from "./Socket";
import { Bridge } from "./Bridge";

/** SakuraMC プロキシ */
export class Proxy extends EventEmitter {
    /** 制御サーバー */
    public controlServer: Server;
    /** データ受付サーバー */
    public receptionServer: Server;

    /** アクティブな制御ソケット */
    public controlSocket: Socket | null = null;

    private _peerSocketRequestResolves: Record<string, (socket: Socket) => any> = {};

    /**
     * @param controlPort 制御ポート
     * @param receptionPort データ受付ポート
     */
    constructor(controlPort: number = 12343, receptionPort: number = 25565) {
        super();

        this.controlServer = createServer().on("listening", () => {
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
                        if (this.controlSocket === null) {
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
                            socket.destroy();
                        }
                    } else if (data[0] === SocketOpCode.CONNECT) {
                        if (this.controlSocket !== null) {
                            socket.write(Buffer.from([
                                SocketOpCode.CONNECT,
                                SocketCloseCode.OK
                            ]));
                            // TODO: 認証がない
                            this._newPeerSocket(data.subarray(2, data[1] + 2).toString(), socket);
                        } else {
                            socket.write(Buffer.from([
                                SocketOpCode.CONNECT,
                                SocketCloseCode.INVALID_PEER_ID
                            ]));
                            socket.destroy();
                        }
                    } else {
                        socket.destroy();
                    }
                    resolve(SocketCloseCode.UNKNOWN);
                })
            );
            if (connectResult === SocketCloseCode.OK) {
                this.controlSocket = socket;
                console.log(`${this.controlSocket.remoteAddress} がプロキシを予約しました`);

                socket.on("close", () => {
                    if (this.controlSocket) {
                        console.log(`${this.controlSocket.remoteAddress} がプロキシの使用を終了しました`);
                        this.controlSocket = null;
                    }
                });
            }
        }).on("error", err => {
            console.error(err);
        }).listen(controlPort);

        this.receptionServer = createServer().on("listening", () => {
            console.log(`ポート ${receptionPort} で Minecraft 接続を待機しています`);
        }).on("connection", async thirdparty => {
            if (this.controlSocket === null) {
                thirdparty.end();
                return;
            }

            const connectionId = `${thirdparty.remoteAddress}:${thirdparty.remotePort}`;
            new Bridge(thirdparty, this._requestPeerSocket(this.controlSocket, connectionId));
        }).on("error", err => {
            // TODO: サードパーティーソケットのエラーはどうするべきか
            console.error(err);
        }).listen(receptionPort);
    }

    /**
     * クライアントにピアソケットを作成するよう要求します。
     * @param controlSocket 制御ソケット
     * @param peerId ピアソケットID
     */
    private async _requestPeerSocket(controlSocket: Socket, peerId: string): Promise<Socket> {
        return await new Promise<Socket>((resolve, reject) => {
            this._peerSocketRequestResolves[peerId] = resolve;
            controlSocket.write(Buffer.concat([Buffer.from([SocketOpCode.CONNECT, peerId.length]), Buffer.from(peerId)]));
        });
    }
    /**
     * 新規ピアソケットが接続された際に、プロキシから呼ばれる関数です。
     */
    private _newPeerSocket(peerId: string, socket: Socket): void {
        this._peerSocketRequestResolves[peerId]?.(socket);
        delete this._peerSocketRequestResolves[peerId];
    }
}