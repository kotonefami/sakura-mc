import { BufferReader, BufferWriter } from "./Buffer";

/** Minecraft のパケットに対応した {@link BufferReader} です。 */
export class MinecraftBufferReader extends BufferReader {
    /**
     * 符号なしビッグエンディアン可変長数値を取得します。
     */
    public readVarUInt(): number {
        let value = 0;
        let length = 0;
        // NOTE: 最上位ビットが1である、途中のバイト
        while (this.data.getUint8(this.cursor) >= 0b10000000) {
            // NOTE: 最上位ビットを反転
            let byte = this.data.getUint8(this.cursor) ^ 0b10000000;
            // NOTE: 前回の値と連結
            value = value | byte << (7 * length);

            this.cursor++;
            length++;
        }
        // NOTE: 最上位ビットが0である、最後のバイトを連結
        value = value | this.readUInt8() << (7 * length);

        return value;
    }
}

/** Minecraft のパケットに対応した {@link BufferWriter} です。 */
export class MinecraftBufferWriter extends BufferWriter {
    /**
     * 符号なしビッグエンティアン可変長数値を書き込みます。
     * @param value 数値
     */
    public writeVarUInt(value: number): this {
        let binaries: string[] = [];
        let binaryValue: string = value.toString(2);
        for (let i = 0; i < Math.floor(binaryValue.length / 7); i++) {
            binaries.push(binaryValue.slice(-7));
            binaryValue = binaryValue.slice(0, binaryValue.length - 7);
        }
        binaries.push(binaryValue.padStart(7, "0"));
        binaries = binaries.map((b, i) => (i === binaries.length - 1 ? "0" : "1") + b);

        this.writeBuffer(binaries.map(b => parseInt(b, 2)));

        return this;
    }
}
