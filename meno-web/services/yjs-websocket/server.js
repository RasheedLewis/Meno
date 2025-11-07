#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Simple y-websocket bridge for local development and small-scale deployments.
 */

const http = require("http");
const { URL } = require("url");
const { WebSocketServer } = require("ws");
const { setupWSConnection } = require("y-websocket/bin/utils");

const DEFAULT_PORT = 1234;
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PATH = "/yjs";

const port = Number.parseInt(process.env.YJS_PORT ?? `${DEFAULT_PORT}`, 10);
const host = process.env.YJS_HOST ?? DEFAULT_HOST;
const path = process.env.YJS_PATH ?? DEFAULT_PATH;

const matchesPath = (pathname) => {
    if (path === "/") {
        return true;
    }
    if (pathname === path) {
        return true;
    }
    return pathname.startsWith(`${path}/`);
};

const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url && req.url.startsWith("/health")) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
        return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
});

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws, request) => {
    const { pathname } = new URL(request.url ?? "", "http://localhost");
    console.log("yjs connection open", pathname);
    setupWSConnection(ws, request, {
        pingTimeout: 30_000,
    });

    ws.on("close", (code, reason) => {
        console.log("yjs connection close", pathname, code, reason.toString());
    });

    ws.on("error", (error) => {
        console.error("yjs connection error", pathname, error);
    });
});

server.on("upgrade", (request, socket, head) => {
    const { url } = request;

    if (!url) {
        socket.destroy();
        return;
    }

    const { pathname } = new URL(url, `http://${request.headers.host ?? "localhost"}`);

    if (!matchesPath(pathname)) {
        socket.destroy();
        return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
    });
});

server.listen(port, host, () => {
    console.log(`y-websocket server listening on ws://${host}:${port}${path === "/" ? "" : path}`);
});

const shutdown = () => {
    console.log("Shutting down y-websocket server");
    wss.close(() => {
        server.close(() => {
            process.exit(0);
        });
    });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

