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

    /** ピアソケットの作成 */
    CONNECT = 1,
};

/** 制御ソケットクローズコード */
export enum SocketCloseCode {
    /** 正常 */
    OK = 0,

    /** 不明なエラー */
    UNKNOWN = 1,

    /** プロキシが予約済み */
    RESERVED = 2,

    /** ピアソケットIDが不正 */
    INVALID_PEER_ID = 3,
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