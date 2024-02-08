import type { Socket } from "node:net";
import { createPeerSocket } from "./client/Peer";
import { EventEmitter } from "node:events";

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
    public peerA: Socket;
    /** ピアB */
    public peerB: Socket;

    constructor(peerA: Socket, peerB: Socket) {
        super();

        this.peerA = peerA;
        this.peerB = peerB;

        this.peerA.on("data", data => this.peerB.write(data));
        this.peerB.on("data", data => this.peerA.write(data));

        this.peerA.once("close", () => this.close());
        this.peerB.once("close", () => this.close());
    }

    /**
     * ブリッジとソケットを終了します。
     */
    public close() {
        if (!this.peerA.closed) this.peerA.end();
        if (!this.peerB.closed) this.peerB.end();

        this.emit("close");
    }
}