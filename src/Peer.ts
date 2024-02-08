/*
 * ピアソケット: プロキシ・クライアント間のデータ通信用ソケット。
 */

import { Socket, connect } from "net";
import { Address, SocketCloseCode, SocketError, SocketOpCode } from "./Socket";

/**
 * プロキシとのピアソケットを作成します。
 * @param proxy プロキシ
 * @param peerId ピアソケットID
 */
export async function createPeerSocket(proxy: Address, peerId: string): Promise<Socket> {
    return await new Promise<Socket>((resolve, reject) => {
        const socket = connect({
            host: proxy.host,
            port: proxy.port
        }).once("data", data => {
            resolve(socket);
        }).once("close", () => {
            reject(new SocketError(SocketCloseCode.INVALID_PEER_ID));
        });
        socket.write(Buffer.concat([Buffer.from([SocketOpCode.CONNECT, peerId.length]), Buffer.from(peerId)]));
    });
}

let peerSocketRequestResolves: Record<string, (socket: Socket) => any> = {};

/**
 * クライアントにピアソケットを作成するよう要求します。
 * @param controlSocket 制御ソケット
 * @param peerId ピアソケットID
 */
export async function requestPeerSocket(controlSocket: Socket, peerId: string): Promise<Socket> {
    return await new Promise<Socket>((resolve, reject) => {
        peerSocketRequestResolves[peerId] = resolve;
        controlSocket.write(Buffer.concat([Buffer.from([SocketOpCode.CONNECT, peerId.length]), Buffer.from(peerId)]));
    });
}

/**
 * 新規ピアソケットが接続された際に、プロキシから呼ばれる関数です。
 */
export function newPeerSocket(peerId: string, socket: Socket): void {
    peerSocketRequestResolves[peerId]?.(socket);
    delete peerSocketRequestResolves[peerId];
}