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
        this.discord.user?.setStatus(PresenceUpdateStatus.Invisible);
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

    private _updateActivity() {
        if (!this.proxy) return;

        if (this.proxy.controlSocket) {
            if (this.proxy.receptionServer.connections > 0) {
                this.discord.user?.setStatus(PresenceUpdateStatus.Online);
                this.discord.user?.setActivity({ name: `${this.proxy.receptionServer.connections}人がMinecraft`, type: ActivityType.Playing });
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
