import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";
import { createHub } from "./hub.mjs";
import { announceRoom } from "./mdns.mjs";
import { isPrivateAddress } from "../public/js/privacy.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

function localIps() {
  const found = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.internal || entry.family !== "IPv4") continue;
      if (isPrivateAddress(entry.address)) found.push(entry.address);
    }
  }
  return found;
}

function headers() {
  return {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "Permissions-Policy": "microphone=(), camera=(), geolocation=(), payment=()",
  };
}

function serve(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, headers());
    res.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400, headers());
    res.end();
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  const file = path.resolve(ROOT, pathname.slice(1));
  if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) {
    res.writeHead(403, headers());
    res.end();
    return;
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, { ...headers(), "Content-Type": "text/plain; charset=utf-8" });
      res.end("The room is dark.");
      return;
    }
    const type = TYPES[path.extname(file)] || "application/octet-stream";
    res.writeHead(200, { ...headers(), "Content-Type": type, "Content-Length": data.length });
    if (req.method === "HEAD") res.end();
    else res.end(data);
  });
}

function sanitizeSignal(data) {
  if (!data || typeof data !== "object") return null;
  if (data.description && typeof data.description === "object") {
    const { type, sdp } = data.description;
    if ((type !== "offer" && type !== "answer") || typeof sdp !== "string" || sdp.length > 12000) return null;
    return { description: { type, sdp } };
  }
  if (data.candidate && typeof data.candidate === "object") {
    const candidate = data.candidate;
    if (typeof candidate.candidate !== "string" || candidate.candidate.length > 1000) return null;
    return {
      candidate: {
        candidate: candidate.candidate,
        sdpMid: typeof candidate.sdpMid === "string" ? candidate.sdpMid : null,
        sdpMLineIndex: Number.isInteger(candidate.sdpMLineIndex) ? candidate.sdpMLineIndex : 0,
        usernameFragment: typeof candidate.usernameFragment === "string" ? candidate.usernameFragment : undefined,
      },
    };
  }
  return null;
}

function attachSocket(server, hub) {
  const wss = new WebSocketServer({ server, path: "/room", maxPayload: 16384, perMessageDeflate: false });
  wss.on("connection", (ws, req) => {
    if (!isPrivateAddress(req.socket.remoteAddress)) {
      ws.close(4003);
      return;
    }
    let id = null;
    ws.on("message", (data, isBinary) => {
      if (isBinary || data.length > 16384) return;
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!message || typeof message !== "object") return;
      if (message.t === "hello" && id === null) {
        if (typeof message.id !== "string" || !ID.test(message.id)) return;
        const joined = hub.join(message.id, (raw) => {
          if (ws.readyState === ws.OPEN) ws.send(raw);
        });
        if (!joined.ok) {
          ws.send(JSON.stringify({ t: joined.reason === "full" ? "full" : "no" }));
          ws.close(4000);
          return;
        }
        id = message.id;
        ws.send(JSON.stringify({ t: "welcome", peers: joined.peers }));
        return;
      }
      if (!id) return;
      if (message.t === "signal") {
        if (typeof message.to !== "string" || !ID.test(message.to)) return;
        const clean = sanitizeSignal(message.data);
        if (clean) hub.signal(id, message.to, clean);
      } else if (message.t === "forget") {
        hub.leave(id);
        id = null;
        ws.close(1000);
      }
    });
    const gone = () => {
      if (id) hub.leave(id);
      id = null;
    };
    ws.on("close", gone);
    ws.on("error", gone);
  });
  return wss;
}

async function certificate(ips) {
  const selfsigned = (await import("selfsigned")).default;
  const altNames = [
    { type: 2, value: "the-room.local" },
    { type: 2, value: "localhost" },
    { type: 7, ip: "127.0.0.1" },
    ...ips.map((ip) => ({ type: 7, ip })),
  ];
  return selfsigned.generate([{ name: "commonName", value: "the-room.local" }], {
    days: 2,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [{ name: "subjectAltName", altNames }],
  });
}

export async function lightHearth({
  port = 0,
  httpsPort = 0,
  host = "127.0.0.1",
  announce = false,
  https: useHttps = false,
} = {}) {
  const hub = createHub();
  const httpServer = http.createServer(serve);
  const sockets = [attachSocket(httpServer, hub)];
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, resolve);
  });

  let httpsServer = null;
  if (useHttps) {
    try {
      const ips = localIps();
      const pems = await certificate(ips);
      httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, serve);
      sockets.push(attachSocket(httpsServer, hub));
      await new Promise((resolve, reject) => {
        httpsServer.once("error", reject);
        httpsServer.listen(httpsPort, host, resolve);
      });
    } catch (error) {
      httpsServer = null;
      console.error("a private light could not be made:", error.message);
    }
  }

  const ips = localIps();
  const announcement = announce
    ? announceRoom({ port: httpServer.address().port, ips })
    : { announced: false, close() {} };

  return {
    hub,
    host,
    port: httpServer.address().port,
    httpsPort: httpsServer ? httpsServer.address().port : null,
    ips,
    announced: Boolean(announcement.announced),
    async close() {
      announcement.close();
      for (const socket of sockets) {
        for (const client of socket.clients) client.terminate();
        socket.close();
      }
      httpServer.closeAllConnections?.();
      httpsServer?.closeAllConnections?.();
      await new Promise((resolve) => httpServer.close(resolve));
      if (httpsServer) await new Promise((resolve) => httpsServer.close(resolve));
    },
  };
}

function printBanner(room) {
  const lines = ["", "  the room is lit", "", `  here           http://localhost:${room.port}`];
  for (const ip of room.ips) lines.push(`  in the room     http://${ip}:${room.port}`);
  lines.push(`  by name        http://the-room.local:${room.port}`);
  if (room.httpsPort) {
    lines.push("", "  a private light, if a phone asks for one");
    lines.push(`                 https://the-room.local:${room.httpsPort}`);
  }
  lines.push("", "  nothing here is written down.", "");
  console.log(lines.join("\n"));
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  const port = Number(process.env.THE_ROOM_PORT || 4545);
  const httpsPort = Number(process.env.THE_ROOM_HTTPS_PORT || port + 1);
  try {
    const room = await lightHearth({
      port,
      httpsPort,
      host: "0.0.0.0",
      announce: true,
      https: true,
    });
    printBanner(room);
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.on(signal, () => {
        room.close().then(() => process.exit(0));
      });
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
