import { createServer, Server, type Socket } from "node:net";
import { EventEmitter } from "node:stream";
import { SocketCloseCode, SocketOpCode } from "./Socket";
import { Bridge } from "./Bridge";
import { MinecraftBufferReader } from "./minecraft/MinecraftBuffer";
import { MinecraftHandshakePacket, MinecraftLoginClientboundPacket, MinecraftPacketEncoder, MinecraftState, MinecraftStatusPacket } from "./minecraft/MinecraftPacket";
import logger from "sakura-logger";

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
            logger.info("SakuraMC - Minecraft port-transfering proxy");
            logger.info(`ポート ${controlPort} でクライアント接続を待機しています`);
        }).on("connection", async socket => {
            socket.on("error", err => {
                if (err.message.includes("ECONNRESET")) return;
                logger.error(err);
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
                logger.debug(`${this.controlSocket.remoteAddress} がプロキシを予約しました`);

                socket.on("close", () => {
                    if (this.controlSocket) {
                        logger.debug(`${this.controlSocket.remoteAddress} がプロキシの使用を終了しました`);
                        this.controlSocket = null;
                    }
                });
            }
        }).on("error", err => {
            logger.error(err);
        }).listen(controlPort);

        this.receptionServer = createServer().on("listening", () => {
            logger.info(`ポート ${receptionPort} で Minecraft 接続を待機しています`);
        }).on("connection", async thirdparty => {
            thirdparty.on("error", () => {});

            if (this.controlSocket === null) {
                let state: MinecraftState = MinecraftState.HANDSHAKE;
                let protocolVersion: number = 0;
                let host: string = "";
                let port: number = 0;

                thirdparty.on("data", data => {
                    const reader = new MinecraftBufferReader(data);
                    const packet = new MinecraftBufferReader(reader.readBuffer(reader.readVarUInt()));
                    const packetId = packet.readVarUInt();
                    const body = new MinecraftBufferReader(packet.readBuffer(packet.data.byteLength - packet.cursor));

                    if (state === MinecraftState.HANDSHAKE) {
                        if (packetId === MinecraftHandshakePacket.HANDSHAKE) {
                            protocolVersion = body.readVarUInt();
                            host = body.readString(body.readUInt8());
                            port = body.readUInt16();

                            state = body.readInt8() as MinecraftState;
                        }
                    } else if (state === MinecraftState.STATUS) {
                        if (packetId === MinecraftStatusPacket.STATUS) {
                            thirdparty.write(Buffer.from(new MinecraftPacketEncoder(MinecraftStatusPacket.STATUS).write(JSON.stringify({
                                "version": {
                                    "name": "§4Offline",
                                    "protocol": protocolVersion
                                },
                                "players": {
                                    "max": 0,
                                    "online": 0,
                                    "sample": [
                                        { id: "13df8ae6-b474-4478-8a32-c34e755b5ef8", name: "§cSakuraMC プロキシが有効なクライアントに接続されていないため、" },
                                        { id: "4dbedfaf-fb20-4acc-831e-390b6d7b735e", name: "§cMinecraft サーバーに接続できませんでした。" }
                                    ]
                                },
                                "description": {
                                    "text": "§cバックエンドサーバーに接続できません"
                                },
                                "favicon": "data:image/png;base64,",
                                "enforcesSecureChat": false,
                                "previewsChat": false
                            }), { withVarUIntLength: true }).arrayBuffer()));
                        } else if (packetId === MinecraftStatusPacket.PING) {
                            thirdparty.write(Buffer.from(new MinecraftPacketEncoder(MinecraftStatusPacket.PING).write(body.data.buffer, { withVarUIntLength: true }).arrayBuffer()));
                        }
                    } else if (state === MinecraftState.LOGIN) {
                        if (packetId === MinecraftLoginClientboundPacket.DISCONNECT) {
                            thirdparty.write(Buffer.from(new MinecraftPacketEncoder(MinecraftLoginClientboundPacket.DISCONNECT).write(JSON.stringify({
                                "text": "SakuraMC プロキシが有効なクライアントに接続されていないため、\nMinecraft サーバーに接続できませんでした。"
                            }), { withVarUIntLength: true }).arrayBuffer()));
                        }
                    }
                });
                return;
            }

            const connectionId = `${thirdparty.remoteAddress}:${thirdparty.remotePort}`;
            new Bridge(thirdparty, this._requestPeerSocket(this.controlSocket, connectionId));
        }).on("error", err => {
            // TODO: サードパーティーソケットのエラーはどうするべきか
            logger.error(err);
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