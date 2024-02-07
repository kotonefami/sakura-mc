/** アドレスデータ */
export type Address = {
    /** IPアドレスもしくはホスト名 */
    host: string;

    /** ポート */
    port: number;
};

/** 制御ソケットオペコード */
export enum SocketOpCode {
    /** ハンドシェイク */
    HANDSHAKE = 0,

    /** コネクション作成 */
    CONNECT = 1,

    /** コネクション削除 */
    DISCONNECT = 2,

    /** データ */
    DATA = 3
};

/** 制御ソケットクローズコード */
export enum SocketCloseCode {
    /** 正常 */
    OK = 0,

    /** 不明なエラー */
    UNKNOWN = 1,

    /** プロキシが予約済み */
    RESERVED = 2,
};

/** ソケットエラー */
export class SocketError extends Error {
    constructor(code: SocketCloseCode) {
        super(`Socket closed by code ${code}`);
        this.name = "SocketError";
    }
}

/**
 * `SERVER:PORT` 形式からサーバーとポートを抽出します。
 * @param `SERVER:PORT`
 */
export function resolveAddress(value: string): Address {
    const arr = value.split(":");
    return {
        host: arr[0],
        port: parseInt(arr[1] ?? "25565")
    };
}

/**
 * 可変長数値表現に変換します。
 * @param value 値
 */
export function encodeVarInt(value: number): number[] {
    let buffer: Array<number> = [];
    buffer.push(value & 0b01111111);
    value = value >> 7;
    while (value > 0) {
        buffer.push(0b10000000 + (value & 0b01111111));
        value = value >> 7;
    }
    return buffer.reverse();
}