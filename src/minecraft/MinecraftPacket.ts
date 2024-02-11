import { MinecraftBufferWriter } from "./MinecraftBuffer";

/** Minecraft の通信におけるステートです。 */
export enum MinecraftState {
    HANDSHAKE = 0,

    STATUS = 1,

    LOGIN = 2
}

/** Minecraft の通信において、 Handshake ステートにおけるパケットIDです。 */
export enum MinecraftHandshakePacket {
    HANDSHAKE = 0x00
}

/** Minecraft の通信において、 Status ステートにおけるパケットIDです。 */
export enum MinecraftStatusPacket {
    STATUS = 0x00,

    PING = 0x01
}

/** Minecraft の通信において、 Login ステートにおけるクライアント向きのパケットIDです。 */
export enum MinecraftLoginClientboundPacket {
    DISCONNECT = 0x00
}

/** Minecraft のパケットのエンコードクラスです。 */
export class MinecraftPacketEncoder extends MinecraftBufferWriter {

    /** パケット ID */
    public packetId: number;

    /**
     * @param packetId パケット ID
     */
    constructor(packetId: number) {
        super();
        this.packetId = packetId;
        this.writeVarUInt(packetId);
    }

    public arrayBuffer(): ArrayBuffer {
        return new MinecraftBufferWriter().write(super.arrayBuffer(), { withVarUIntLength: true }).arrayBuffer();
    }

}