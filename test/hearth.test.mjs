import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";
import { lightHearth } from "../server/hearth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the page is served once, and not stored", async () => {
  const room = await lightHearth({ port: 0, announce: false, https: false });
  try {
    const response = await fetch(`http://127.0.0.1:${room.port}/`);
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.match(text, /The Room/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
    assert.equal(response.headers.get("permissions-policy").includes("microphone=()"), true);

    const missing = await fetch(`http://127.0.0.1:${room.port}/../server/hearth.mjs`);
    assert.equal(missing.status, 404);
  } finally {
    await room.close();
  }
});

test("two candles can find each other and then be forgotten", async () => {
  const room = await lightHearth({ port: 0, announce: false, https: false });
  const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  let wsA;
  let wsB;
  try {
    wsA = new WebSocket(`ws://127.0.0.1:${room.port}/room`);
    const inboxA = listen(wsA);
    const welcomeA = await opened(wsA, inboxA, idA);
    assert.deepEqual(welcomeA.peers, []);

    wsB = new WebSocket(`ws://127.0.0.1:${room.port}/room`);
    const inboxB = listen(wsB);
    const welcomeB = await opened(wsB, inboxB, idB);
    assert.deepEqual(welcomeB.peers, [idA]);

    const joined = await inboxA.next();
    assert.equal(joined.t, "joined");
    assert.equal(joined.id, idB);

    wsA.send(JSON.stringify({
      t: "signal",
      to: idB,
      data: { description: { type: "offer", sdp: "v=0" } },
    }));
    const signal = await inboxB.next();
    assert.equal(signal.t, "signal");
    assert.equal(signal.data.description.sdp, "v=0");

    wsB.send(JSON.stringify({ t: "forget" }));
    const forgotten = await inboxA.next();
    assert.equal(forgotten.t, "left");
    assert.equal(room.hub.size(), 1);
  } finally {
    wsA?.close();
    wsB?.close();
    await room.close();
  }
});

test("the room keeps nothing on disk and calls nobody outside", () => {
  const banned = ["localStorage", "sessionStorage", "indexedDB", "sendBeacon", "stun:", "googletagmanager", "google-analytics"];
  const files = walk(path.join(ROOT, "public")).concat(walk(path.join(ROOT, "server")));
  for (const file of files) {
    if (!/\.(js|mjs|css|html)$/.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const word of banned) {
      assert.equal(text.includes(word), false, `${path.relative(ROOT, file)} contains ${word}`);
    }
  }
});

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function listen(socket) {
  const queue = [];
  const waiters = [];
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else queue.push(message);
  });
  return {
    next() {
      if (queue.length) return Promise.resolve(queue.shift());
      return new Promise((resolve) => waiters.push(resolve));
    },
  };
}

function opened(socket, inbox, id) {
  return new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.once("open", () => {
      socket.send(JSON.stringify({ t: "hello", id }));
      inbox.next().then(resolve, reject);
    });
  });
}
