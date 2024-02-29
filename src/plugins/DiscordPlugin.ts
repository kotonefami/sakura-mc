import { ActivityType, Client, PresenceUpdateStatus } from "discord.js";
import { IPlugin, PluginEvent } from "./IPlugin";
import { Proxy } from "../Proxy";

export class DiscordPlugin implements IPlugin {
    public discord = new Client({
        intents: []
    });
    public proxy?: Proxy;

    private _token: string;

    /**
     * @param token Discord bot token
     */
    constructor(token: string) {
        this._token = token;
    }

    async onStart(_: PluginEvent, proxy: Proxy): Promise<void> {
        this.proxy = proxy;
        await this.discord.login(this._token);
        this._updateActivity();
    }
    async onStop(): Promise<void> {
        this.discord.user?.setStatus(PresenceUpdateStatus.Invisible);
        await this.discord.destroy();
    }

    onConnectClient() {
        this._updateActivity();
    }
    onDisconnectClient() {
        this._updateActivity();
    }
    onConnectThirdparty() {
        this._updateActivity();
    }
    onDisconnectThirdparty() {
        this._updateActivity();
    }

    private async _getConnectionCount(): Promise<number> {
        return await new Promise<number>((resolve, reject) => {
            if (!this.proxy) {
                resolve(0);
            } else {
                this.proxy.receptionServer.getConnections((error, count) => {
                    if (error) resolve(0);
                    resolve(count);
                });
            }
        });
    }

    private async _updateActivity(): Promise<void> {
        if (!this.proxy) return;

        if (this.proxy.controlSocket) {
            const connectionCount = await this._getConnectionCount();
            if (connectionCount > 0) {
                // TODO: Ping でもここが走ってしまう
                this.discord.user?.setStatus(PresenceUpdateStatus.Online);
                this.discord.user?.setActivity({ name: `${connectionCount}人がMinecraft`, type: ActivityType.Playing });
            } else {
                this.discord.user?.setStatus(PresenceUpdateStatus.Online);
                this.discord.user?.setActivity({ name: "Minecraft", type: ActivityType.Playing });
            }
        } else {
            this.discord.user?.setStatus(PresenceUpdateStatus.Idle);
            this.discord.user?.setActivity({ name: "クライアントに接続していません", type: ActivityType.Custom });
        }
    }
}
