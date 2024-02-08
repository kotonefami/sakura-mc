import { Socket, connect } from "net";
import { SocketOpCode, SocketCloseCode, Address, SocketError } from "./Socket";
import { EventEmitter } from "stream";
import { Bridge } from "./Bridge";
import { createPeerSocket } from "./Peer";

/** クライアント */
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
                    this.bridges[peerId] = new Bridge(await createPeerSocket(proxy, peerId), connect(this.destination)).once("close", () => {
                        if (peerId in this.bridges) delete this.bridges[peerId];
                    });
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