import { Socket } from "net";
import { isPromise } from "util/types";

/** ソケットが確立するまでの間に送信されたパケットを、ソケットが確立した後に送信するクラスです。 */
export class Pool {
    /** プールされているバッファ */
    public buffers: Buffer[] = [];

    private _socket: Socket | PromiseLike<Socket> | null = null;

    constructor(socket: Socket | PromiseLike<Socket>) {
        this._socket = socket;
    }

    /** ソケット */
    public get socket(): Socket | PromiseLike<Socket> | null {
        return this._socket;
    }
    public set socket(socket: Socket | PromiseLike<Socket>) {
        this._socket = socket;

        if (socket instanceof Promise) {
            socket.then(this._resolve);
        } else {
            this._resolve(socket as Socket);
        }
    }

    private _resolve(socket: Socket): void {
        for (const buffer of this.buffers) socket.write(buffer);
        this.buffers = [];
        this._socket = socket;
    }

    /** プールにバッファを送信します。 */
    public push(buffer: Buffer) {
        if (this.socket instanceof Socket) {
            this.socket.write(buffer);
        } else {
            this.buffers.push(buffer);
        }
    }
}