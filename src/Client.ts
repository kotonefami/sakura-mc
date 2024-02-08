import { Socket, connect } from "node:net";
import { EventEmitter } from "node:stream";
import { SocketOpCode, SocketCloseCode, Address, SocketError } from "./Socket";
import { Bridge } from "./Bridge";

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

    constructor(proxy: Address, destination: Address) {
        super();

        this.proxy = proxy;
        this.destination = destination;
        this.controlSocket = connect({
            host: this.proxy.host,
            port: this.proxy.port
        });

        this._connectPromise = new Promise<SocketCloseCode>((resolve, reject) => {
            this.controlSocket.on("error", err => this.emit("error", err));
            this.controlSocket.once("connect", () => {
                this.controlSocket.write(Buffer.from([
                    SocketOpCode.HANDSHAKE
                ]));

                this.controlSocket.once("data", data => {
                    if (data[0] === SocketOpCode.HANDSHAKE) {
                        if (data[1] === SocketCloseCode.OK) {
                            console.log(`プロキシ ${this.proxy.host}:${this.proxy.port} との接続を確立しました`);
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
                    process.exit(1);
                });
            });
        }).catch((code: SocketCloseCode) => {
            this.emit("error", new SocketError(code));
            return code;
        }).then(code => {
            this.controlSocket.on("data", async data => {
                const peerId = data.subarray(2, data[1] + 2).toString();
                if (data[0] === SocketOpCode.CONNECT) {
                    this.bridges[peerId] = new Bridge(await this._createPeerSocket(peerId), connect(this.destination).on("error", err => {
                        const errorCode = (err as Error & { code: string; }).code ?? "";

                        if (errorCode === "ECONNREFUSED") {
                            console.error(`${this.destination.host}:${this.destination.port} に接続できませんでした。 (ECONNREFUSED)`);
                        } else {
                            console.error(err);
                        }
                    })).once("close", () => {
                        if (peerId in this.bridges) delete this.bridges[peerId];
                    });
                }
            });

            return code;
        });
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