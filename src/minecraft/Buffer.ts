type BufferWriterOptions = {
    withVarUIntLength?: boolean;
};

/**
 * {@link ArrayBuffer} を文字列に変換します。
 * @param buffer バッファ
 */
export function bufferToString(buffer: ArrayBuffer): string {
    return new TextDecoder().decode(buffer);
}
/**
 * 文字列を {@link ArrayBuffer} に変換します。
 * @param string 文字列
 */
export function stringToBuffer(string: string): ArrayBuffer {
    return new TextEncoder().encode(string).buffer;
}

/**
 * {@link ArrayBuffer} を連結します。
 * @param buffers 連結したいバッファ
 */
export function concatArrayBuffer(buffers: Array<ArrayBufferLike>): ArrayBuffer {
    const sumLength = buffers.map(b => b.byteLength).reduce((a, b) => a + b);
    const resultArray = new Uint8Array(sumLength);
    let cursor = 0;
    for (const buffer of buffers) {
        resultArray.set(new Uint8Array(buffer), cursor);
        cursor += buffer.byteLength;
    }
    return resultArray.buffer;
}

/**
 * バイナリの手続き型リーダーです。
 */
export class BinaryReader {
    /**
     * バイナリ
     */
    data: Array<boolean>;
    /**
     * 現在読み込みが完了したバッファのインデックス
     */
    cursor: number;

    constructor(binary: Array<boolean | number> | number) {
        if (Array.isArray(binary)) {
            this.data = binary.map(b => b === true || b === 1);
        } else {
            this.data = binary.toString(2).split("").map(b => b === "1");
        }

        this.cursor = 0;
    }

    /**
     * 指定された長さのビットを読み込みます。
     * @param length 長さ
     */
    public read(length: number): number {
        this.cursor += length;
        return parseInt(this.data.slice(this.cursor - length, this.cursor).map(b => b ? "1" : "0").join(""), 2);
    }

    /**
     * 1ビットを読み込みます。
     */
    public readBoolean(): boolean {
        return this.read(1) === 1;
    }
}

/**
 * バッファの手続き型リーダーです。
 */
export class BufferReader {
    /**
     * バッファの {@link DataView} オブジェクト
     */
    data: DataView;
    /**
     * 現在読み込みが完了したバッファのインデックス
     */
    cursor: number;

    constructor(buffer: Uint8Array | ArrayBufferLike) {
        this.data = buffer instanceof Uint8Array ? new DataView(buffer.buffer) : new DataView(buffer);
        this.cursor = 0;
    }

    /**
     * 与えられたバイナリ配列と同一であるか確認します。
     * @param buffer 比較対象
     */
    public check(buffer: Array<number>): boolean {
        if (this.data.byteLength - buffer.length >= 0) {
            return buffer.every(b => this.readUInt8() === b);
        } else {
            return false;
        }
    }

    /**
     * カーソルを動かさずに、与えられたバイナリ配列と同一であるか確認します。
     * @param buffer 比較対象
     */
    public checkInstant(buffer: Array<number>): boolean {
        if (this.data.byteLength - buffer.length >= 0) {
            return buffer.every((b, i) => this.data.getUint8(this.cursor + i) === b);
        } else {
            return false;
        }
    }

    /**
     * 8ビット（1バイト）の符号なし数値を取得します。
     */
    public readUInt8(): number {
        this.cursor += 1;
        return this.data.getUint8(this.cursor - 1);
    }

    /**
     * 8ビット（1バイト）の符号あり数値を取得します。
     */
    public readInt8(): number {
        this.cursor += 1;
        return this.data.getInt8(this.cursor - 1);
    }

    /**
     * 16ビット（2バイト）の符号なし数値を取得します。
     */
    public readUInt16(): number {
        this.cursor += 2;
        return this.data.getUint16(this.cursor - 2);
    }

    /**
     * 16ビット（2バイト）の符号あり数値を取得します。
     */
    public readInt16(): number {
        this.cursor += 2;
        return this.data.getInt16(this.cursor - 2);
    }

    /**
     * 32ビット（4バイト）の符号なし数値を取得します。
     */
    public readUInt32(): number {
        this.cursor += 4;
        return this.data.getUint32(this.cursor - 4);
    }

    /**
     * 32ビット（4バイト）の符号あり数値を取得します。
     */
    public readInt32(): number {
        this.cursor += 4;
        return this.data.getInt32(this.cursor - 4);
    }

    /**
     * 64ビット（8バイト）の符号なし数値を取得します。
     */
    public readUInt64(): bigint {
        this.cursor += 8;
        return this.data.getBigUint64(this.cursor - 8);
    }

    /**
     * 64ビット（8バイト）の符号あり数値を取得します。
     */
    public readInt64(): bigint {
        this.cursor += 8;
        return this.data.getBigInt64(this.cursor - 8);
    }

    /**
     * 符号なし可変長数値を取得します。
     */
    public readVarUInt(): number {
        let value = 0;
        // NOTE: 最上位ビットが1である、途中のバイト
        while (this.data.getUint8(this.cursor) >= 0b10000000) {
            // NOTE: 最上位ビットを反転
            let byte = this.data.getUint8(this.cursor) ^ 0b10000000;
            // NOTE: 前回の値と連結
            value = value << 7 | byte;

            this.cursor++;
        }
        // NOTE: 最上位ビットが0である、最後のバイトを連結
        value = value << 7 | this.readUInt8();

        return value;
    }

    /**
     * 固定長文字列を取得します。
     * @param byteLength 長さ
     */
    public readString(byteLength: number): string {
        return bufferToString(this.readBuffer(byteLength));
    }

    /**
     * 固定長バッファを取得します。
     * @param {number} byteLength 長さ
     */
    public readBuffer(byteLength: number): ArrayBuffer {
        this.cursor += byteLength;
        return this.data.buffer.slice(this.cursor - byteLength, this.cursor);
    }
}

/**
 * バッファの手続き型ライターです。
 */
export class BufferWriter {
    buffers: Array<ArrayBufferLike>;
    cursor: number;

    constructor() {
        this.buffers = [];
        this.cursor = 0;
    }

    /**
     * 8ビット（1バイト）の符号なし数値を書き込みます。
     */
    public writeUInt8(value: number): this {
        this.writeBuffer([value]);

        return this;
    }

    /**
     * 符号なし可変長数値を書き込みます。
     * @param value 数値
     */
    public writeVarUInt(value: number): this {
        let buffer: Array<number> = [];
        buffer.push(value & 0b01111111);
        value = value >> 7;
        while (value > 0) {
            buffer.push(0b10000000 + (value & 0b01111111));
            value = value >> 7;
        }
        this.writeBuffer(buffer.reverse());

        return this;
    }

    /**
     * バッファを書き込みます。
     * @param buffer 書き込むバッファ
     */
    public writeBuffer(buffer: ArrayBuffer | Array<number>): this {
        if (Array.isArray(buffer)) {
            this.buffers.push(new Uint8Array(buffer));
        } else {
            this.buffers.push(buffer);
        }

        return this;
    }

    /**
     * オプション付きで書き込みます。
     * @param content
     * @param options
     */
    public write(content: string | number | Array<number> | ArrayBufferLike, options: BufferWriterOptions = {}): this {
        const options_: BufferWriterOptions = Object.assign({
            compress: false,
            withVarUIntLength: false
        }, options);
        let buffer: any = null;
        if (typeof content === "string") {
            buffer = stringToBuffer(content);
        } else if (typeof content === "number") {
            buffer = new Uint8Array([content]).buffer;
        } else if (Array.isArray(content)) {
            buffer = new Uint8Array(content).buffer;
        } else {
            buffer = content;
        }

        if (options_.withVarUIntLength) {
            this.writeVarUInt(buffer.byteLength);
        }

        this.writeBuffer(buffer);

        return this;
    }

    /**
     * 書き込んだバッファを取得します。
     */
    public arrayBuffer(): ArrayBuffer {
        return concatArrayBuffer(this.buffers);
    }
}