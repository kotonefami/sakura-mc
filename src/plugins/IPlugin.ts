import { Proxy } from "../Proxy";

export type OptionalPromise<T> = T | Promise<T>;

export interface PluginEvent {
    /** プロキシオブジェクト */
    proxy: Proxy;
}

export interface IPlugin {
    /** SakuraMC が動作を開始する際発火します。 */
    onStart?(event: PluginEvent, proxy: Proxy): OptionalPromise<any>;
    /** SakuraMC が動作を終了する際発火します。 */
    onStop?(event: PluginEvent): OptionalPromise<any>;

    /** クライアントに接続した際発火します。 */
    onConnectClient?(event: PluginEvent): OptionalPromise<any>;
    /** クライアントから切断された際発火します。 */
    onDisconnectClient?(event: PluginEvent): OptionalPromise<any>;

    /** サードーパーティーが接続した際発火します。 */
    onConnectThirdparty?(event: PluginEvent): OptionalPromise<any>;
    /** サードーパーティーが切断した際発火します。 */
    onDisconnectThirdparty?(event: PluginEvent): OptionalPromise<any>;

    // TODO: client information
}
