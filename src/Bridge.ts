import type { Socket } from "node:net";
import { EventEmitter } from "node:events";
import { Pool } from "./Pool";

export interface SocketBridge {
    on(event: "close", listener: () => void): this;
    once(event: "close", listener: () => void): this;
    addListener(event: "close", listener: () => void): this;
    prependListener(event: "close", listener: () => void): this;
    prependOnceListener(event: "close", listener: () => void): this;
}

/**
 * 2つのソケットを接続するブリッジです。
 */
export class Bridge extends EventEmitter {
    /** ピアA */
    public peerA: Pool;
    /** ピアB */
    public peerB: Pool;

    /** ソケットA */
    public socketA: Socket | null = null;
    /** ソケットB */
    public socketB: Socket | null = null;

    constructor(peerA: Socket | PromiseLike<Socket>, peerB: Socket | PromiseLike<Socket>) {
        super();

        this.peerA = new Pool(peerA);
        this.peerB = new Pool(peerB);

        Promise.all([peerA, peerB].filter(p => p instanceof Promise)).then(async () => {
            this.socketA = await this.peerA.socket!;
            this.socketB = await this.peerB.socket!;

            this.socketA.on("data", data => this.socketB!.write(data));
            this.socketB.on("data", data => this.socketA!.write(data));

            this.socketA.once("close", () => this.close());
            this.socketB.once("close", () => this.close());
        });
    }

    /**
     * ブリッジとソケットを終了します。
     */
    public close() {
        if (!this.socketA!.closed) this.socketA!.end();
        if (!this.socketB!.closed) this.socketB!.end();

        this.emit("close");
    }
}