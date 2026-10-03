import { createRequire } from "node:module";
import { isPrivateAddress } from "../public/js/privacy.js";

const require = createRequire(import.meta.url);

export const ROOM_HOST = "the-room.local";
export const SERVICE_TYPE = "_theroom._tcp.local";
export const SERVICE_INSTANCE = "The Room._theroom._tcp.local";

function hostRecords(ips) {
  return ips.filter(isPrivateAddress).map((ip) => ({
    name: ROOM_HOST,
    type: "A",
    ttl: 120,
    data: ip,
  }));
}

function srv(port) {
  return {
    name: SERVICE_INSTANCE,
    type: "SRV",
    ttl: 120,
    data: { port, weight: 0, priority: 0, target: ROOM_HOST },
  };
}

function txt() {
  return {
    name: SERVICE_INSTANCE,
    type: "TXT",
    ttl: 120,
    data: [Buffer.from("path=/")],
  };
}

// Answer only the names that belong to this room.
export function recordsFor(question, ctx) {
  const name = String(question?.name || "").toLowerCase().replace(/\.$/, "");
  const type = question?.type || "ANY";
  const want = (record) => type === "ANY" || type === record;
  const answers = [];
  const additionals = [];
  const ips = (ctx.ips || []).filter(isPrivateAddress);

  if (name === "_services._dns-sd._udp.local" && want("PTR")) {
    answers.push({ name: "_services._dns-sd._udp.local", type: "PTR", ttl: 120, data: SERVICE_TYPE });
  }

  if (name === SERVICE_TYPE && want("PTR")) {
    answers.push({ name: SERVICE_TYPE, type: "PTR", ttl: 120, data: SERVICE_INSTANCE });
    additionals.push(srv(ctx.port), txt(), ...hostRecords(ips));
  }

  if (name === SERVICE_INSTANCE.toLowerCase()) {
    if (want("SRV")) answers.push(srv(ctx.port));
    if (want("TXT")) answers.push(txt());
    additionals.push(...hostRecords(ips));
  }

  if (name === ROOM_HOST && want("A")) {
    answers.push(...hostRecords(ips));
  }

  return { answers, additionals };
}

export function announceRoom({ port, ips }) {
  let mdns;
  try {
    const multicast = require("multicast-dns");
    mdns = multicast({ reuseAddr: true, loopback: true });
  } catch (error) {
    return { announced: false, error, close() {} };
  }

  const ctx = { port, ips };
  const onQuery = (query) => {
    const answers = [];
    const additionals = [];
    for (const question of query.questions || []) {
      const found = recordsFor(question, ctx);
      answers.push(...found.answers);
      additionals.push(...found.additionals);
    }
    if (answers.length === 0) return;
    try {
      mdns.respond({ answers, additionals });
    } catch {
      // The network may not have multicast. The lantern still burns by address.
    }
  };

  mdns.on("query", onQuery);
  mdns.on("error", () => {});

  return {
    announced: true,
    close() {
      mdns.removeListener("query", onQuery);
      try {
        mdns.destroy();
      } catch {
        // already gone
      }
    },
  };
}
