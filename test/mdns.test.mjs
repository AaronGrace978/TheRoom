import assert from "node:assert/strict";
import test from "node:test";
import { ROOM_HOST, SERVICE_TYPE, recordsFor } from "../server/mdns.mjs";

test("the room answers for its own name and no one else's", () => {
  const found = recordsFor(
    { name: "the-room.local", type: "A" },
    { port: 4545, ips: ["192.168.0.8", "8.8.8.8"] },
  );
  assert.equal(found.answers.length, 1);
  assert.equal(found.answers[0].data, "192.168.0.8");
  assert.equal(found.answers[0].name, ROOM_HOST);

  const stranger = recordsFor({ name: "other.local", type: "A" }, { port: 4545, ips: ["192.168.0.8"] });
  assert.equal(stranger.answers.length, 0);
});

test("browsing the service type yields the hearth", () => {
  const found = recordsFor({ name: SERVICE_TYPE, type: "PTR" }, { port: 4545, ips: ["10.0.0.4"] });
  assert.equal(found.answers[0].type, "PTR");
  assert.equal(found.additionals.some((record) => record.type === "SRV" && record.data.port === 4545), true);
  assert.equal(found.additionals.some((record) => record.type === "A" && record.data === "10.0.0.4"), true);
});
