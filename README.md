<div align="center">
    <h1>SakuraMC</h1>
    Minecraft port-transfering proxy - <b>without opening the port!</b>
</div>

## Features
* Port-transfering for Minecraft
* Fallback ping server

... and there will be more (dummy minecraft server...) !

## About this system

### With SakuraMC client

```
[ Minecraft client ]
   ↕
[ SakuraMC proxy ]
   ↑
   │  ↓ Request to open a new socket for the Minecraft client
   │
   │  ↑ Open a new socket
   ↓
[ SakuraMC client ]
   ↕
[ Minecraft server ]
```

### Without SakuraMC client

```
[ Minecraft client ]
   ↑
   │  ↓ Ping request
   │
   │  ↑ Return error message and block login
   ↓
[ SakuraMC proxy ]
```

## How to use

### Command line
```shell
$ node dist/index.js proxy 12343 25565
$ node dist/index.js client minecraft-server:25565 sakuramc-proxy:12343
```

### Node.js

```javascript
const controlPort = 12343; // Use this port to receive SakuraMC control packet
const receptionPort = 25565; // Use this port to receive Minecraft packet
new Proxy(controlPort, receptionPort);
```

```javascript
const client = new Client({ host: "sakuramc-proxy", port: 12343 }, { host: "minecraft-server", port: 25565 });
client.on("error", err => {
    console.error(err);
    process.exit(1);
});
```

### Environment without Node.js

```shell
pnpm run pack
```

... And run dist/SakuraMC-Client.exe!