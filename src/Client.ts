import { Socket, connect, createServer } from "net";
import { SocketOpCode, SocketCloseCode, Address, SocketError } from "./Socket";
import { EventEmitter } from "stream";

/** クライアント */
export class Client extends EventEmitter {
    /** プロキシアドレス */
    public proxy: Address;
    /** 転送先アドレス */
    public destination: Address;

    /** 制御ソケット */
    public controlSocket: Socket;

    /** クライアントソケットテーブル */
    public socketTable: Record<string, Socket> = {};

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
            this.controlSocket.on("connect", () => {
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
            this.controlSocket.on("data", data => {
                const sourceAddress = data.subarray(2, data[1] + 2).toString();
                const connectionIdBuffer = Buffer.concat([Buffer.from([sourceAddress.length]), Buffer.from(sourceAddress)]);
                if (data[0] === SocketOpCode.CONNECT) {
                    this.socketTable[sourceAddress] = connect({
                        host: this.destination.host,
                        port: this.destination.port
                    }).on("data", data => {
                        this.controlSocket.write(Buffer.concat([Buffer.from([SocketOpCode.DATA]), connectionIdBuffer, data]))
                    }).once("close", () => {
                        if (sourceAddress in this.socketTable) {
                            this.socketTable[sourceAddress].end();
                            delete this.socketTable[sourceAddress];
                        }
                    });
                } else if (data[0] === SocketOpCode.DISCONNECT) {
                    if (sourceAddress in this.socketTable) {
                        this.socketTable[sourceAddress].end();
                        delete this.socketTable[sourceAddress];
                    }
                } else if (data[0] === SocketOpCode.DATA) {
                    if (sourceAddress in this.socketTable) {
                        this.socketTable[sourceAddress].write(data.subarray(data[1] + 2));
                    } else {
                        console.log("more");
                    }
                }
            });

            return code;
        });
    }

    /**
     * プロキシサーバーに接続します。
     * このメソッドは接続を待機するだけであり、接続処理はインスタンス化された時点で開始されます。
     */
    public async connect(): Promise<SocketCloseCode> {
        return await this._connectPromise;
    }
}