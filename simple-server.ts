import { connect, createServer } from "net";

const server = createServer().once("listening", () => {
    console.log(`Listening`);
}).on("connection", proxySocket => {
    console.log("New Connection!");

    const serverSocket = connect({
        host: "localhost",
        port: 25565
    });
    serverSocket.on("data", data => proxySocket.write(data));
    proxySocket.on("data", data => serverSocket.write(data));

    serverSocket.on("error", console.log);
    proxySocket.on("error", console.log);
    serverSocket.on("close", () => proxySocket.end());
    proxySocket.on("close", () => serverSocket.end());
}).listen(25566);