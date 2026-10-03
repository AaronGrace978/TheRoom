import assert from "node:assert/strict";
import test from "node:test";
import { createHub } from "../server/hub.mjs";

test("a greeting is forwarded and then the room can forget", () => {
  const hub = createHub();
  const heard = { a: [], b: [] };
  const first = hub.join("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", (raw) => heard.a.push(JSON.parse(raw)));
  assert.equal(first.ok, true);
  assert.deepEqual(first.peers, []);

  const second = hub.join("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", (raw) => heard.b.push(JSON.parse(raw)));
  assert.deepEqual(second.peers, ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);
  assert.equal(heard.a.at(-1).t, "joined");

  assert.equal(hub.signal(second.peers[0], "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", { description: { type: "offer" } }), true);
  assert.equal(heard.b.at(-1).t, "signal");
  assert.equal(heard.b.at(-1).from, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

  hub.leave("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(hub.size(), 1);
  assert.equal(heard.b.at(-1).t, "left");
  assert.equal(hub.signal("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", {}), false);
});

test("the room does not grow without limit", () => {
  const hub = createHub({ max: 2 });
  const deliver = () => {};
  assert.equal(hub.join("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", deliver).ok, true);
  assert.equal(hub.join("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", deliver).ok, true);
  assert.equal(hub.join("cccccccc-cccc-4ccc-8ccc-cccccccccccc", deliver).reason, "full");
});
