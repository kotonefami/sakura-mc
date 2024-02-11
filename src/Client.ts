import { Socket, connect } from "node:net";
import { EventEmitter } from "node:stream";
import { SocketOpCode, SocketCloseCode, Address, SocketError } from "./Socket";
import { Bridge } from "./Bridge";
import { wait } from "./utils/Promise";
import logger from "sakura-logger";

interface ClientInit {
    /** ハートビートを送信する間隔（ミリ秒） */
    heartbeatInterval?: number

    /** タイムアウト時間（ミリ秒） */
    timeout?: number;
}

export interface Client {
    on(event: "error", listener: (error: Error) => void): this;
    once(event: "error", listener: (error: Error) => void): this;
    addListener(event: "error", listener: (error: Error) => void): this;
    prependListener(event: "error", listener: (error: Error) => void): this;
    prependOnceListener(event: "error", listener: (error: Error) => void): this;
}

/** SakuraMC クライアント */
export class Client extends EventEmitter {
    /** プロキシアドレス */
    public proxy: Address;
    /** 転送先アドレス */
    public destination: Address;

    /** 制御ソケット */
    public controlSocket: Socket;

    /** ブリッジテーブル */
    public bridges: Record<string, Bridge> = {};

    private _closeReason: SocketCloseCode = SocketCloseCode.UNKNOWN;

    private _connectPromise: Promise<SocketCloseCode>;

    constructor(proxy: Address, destination: Address, options: ClientInit = {}) {
        super();

        let _waitSeconds = 1;
        const reconnect = (): Socket => {
            const heartbeatInterval = setInterval(() => {
                this.controlSocket.write(Buffer.from([SocketOpCode.HEARTBEAT]));
            }, options.heartbeatInterval ?? 10000);

            this.controlSocket = connect({
                host: this.proxy.host,
                port: this.proxy.port
            })
            .setTimeout(options.timeout ?? 30000)
            .on("timeout", () => {
                logger.error(`プロキシとの接続がタイムアウトしました (EVT_TIMEOUT)`);
                this.controlSocket.destroy();
                this.controlSocket = reconnect();
            })
            .on("error", async err => {
                this.controlSocket.destroy();

                const errorCode = (err as Error & { code: string; }).code ?? "";
                if (errorCode === "ECONNREFUSED") {
                    logger.error(`プロキシに接続できませんでした (ECONNREFUSED)`);
                } else if (errorCode === "ECONNRESET") {
                    logger.error(`プロキシとの接続が切断されました (ECONNRESET)`);
                } else {
                    logger.error(err);
                }

                for (let i = 0; i < _waitSeconds; i++) {
                    process.stdout.write(`\r${_waitSeconds - i} 秒後に再接続します...`);
                    await wait(1000);
                    process.stdout.write(`\r`);
                }
                _waitSeconds *= 2;

                this.controlSocket = reconnect();
            })
            .on("close", () => {
                clearInterval(heartbeatInterval);
            });

            this._connectPromise = new Promise<SocketCloseCode>((resolve, reject) => {
                this.controlSocket.once("connect", () => {
                    this.controlSocket.write(Buffer.from([
                        SocketOpCode.HANDSHAKE
                    ]));

                    this.controlSocket.once("data", data => {
                        if (data[0] === SocketOpCode.HANDSHAKE) {
                            if (data[1] === SocketCloseCode.OK) {
                                _waitSeconds = 1;
                                logger.info(`クライアントとしてプロキシに接続しました`);
                                logger.debug(`サードパーティー <=> プロキシ [${this.proxy.host}:${this.proxy.port}] <=> クライアント [localhost:*] <=> サーバー [${this.destination.host}:${this.destination.port}]`);
                                resolve(SocketCloseCode.OK);
                            } else {
                                this._closeReason = data[1];
                            }
                        } else {
                            reject(SocketCloseCode.UNKNOWN);
                        }
                    });
                    this.controlSocket.once("close", () => {
                        reject(this._closeReason);
                    });
                });
            }).then(code => {
                this.controlSocket.on("data", async data => {
                    const peerId = data.subarray(2, data[1] + 2).toString();
                    if (data[0] === SocketOpCode.CONNECT) {
                        this.bridges[peerId] = new Bridge(await this._createPeerSocket(peerId), connect(this.destination).on("error", err => {
                            const errorCode = (err as Error & { code: string; }).code ?? "";

                            if (errorCode === "ECONNREFUSED") {
                                logger.error(`${this.destination.host}:${this.destination.port} に接続できませんでした。 (ECONNREFUSED)`);
                            } else if (errorCode === "ECONNRESET") {
                                logger.error(`${this.destination.host}:${this.destination.port} との接続が切断されました。 (ECONNRESET)`);
                            } else {
                                logger.error(err);
                            }
                        })).once("close", () => {
                            if (peerId in this.bridges) delete this.bridges[peerId];
                        });
                    }
                });

                return code;
            });

            return this.controlSocket;
        };

        this.proxy = proxy;
        this.destination = destination;
        this.controlSocket = reconnect();
        this._connectPromise = new Promise(() => {});
    }

    /**
     * プロキシとのピアソケットを作成します。
     * @param peerId ピアソケットID
     */
    private async _createPeerSocket(peerId: string): Promise<Socket> {
        return await new Promise<Socket>((resolve, reject) => {
            const socket = connect({
                host: this.proxy.host,
                port: this.proxy.port
            }).once("data", data => {
                // TODO: CloseCode から接続成功かどうか判別
                resolve(socket);
            }).once("close", () => {
                reject(new SocketError(SocketCloseCode.INVALID_PEER_ID));
            });
            socket.write(Buffer.concat([Buffer.from([SocketOpCode.CONNECT, peerId.length]), Buffer.from(peerId)]));
        });
    }

    /**
     * プロキシサーバーに接続します。
     * このメソッドは接続を待機するだけであり、接続処理はインスタンス化された時点で開始されます。
     */
    public async connect(): Promise<SocketCloseCode> {
        return await this._connectPromise;
    }

    /**
     * クライアントを終了します。
     */
    public close(): void {
        this.controlSocket.end();
        Object.values(this.bridges).forEach(bridge => bridge.close());
    }
}