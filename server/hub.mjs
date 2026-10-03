// The hearth remembers who is in the room only while they are here.
// It forwards a greeting (SDP, ICE) and then forgets the words.

const MAX_CANDLES = 12;

export function createHub({ max = MAX_CANDLES } = {}) {
  const members = new Map();

  function send(id, message) {
    const member = members.get(id);
    if (!member) return;
    member(JSON.stringify(message));
  }

  return {
    join(id, deliver) {
      if (typeof deliver !== "function") return { ok: false, reason: "silent" };
      if (members.has(id)) return { ok: false, reason: "taken" };
      if (members.size >= max) return { ok: false, reason: "full" };
      const peers = [...members.keys()];
      members.set(id, deliver);
      for (const peerId of peers) send(peerId, { t: "joined", id });
      return { ok: true, peers };
    },

    signal(from, to, data) {
      if (!members.has(from) || !members.has(to) || from === to) return false;
      send(to, { t: "signal", from, data });
      return true;
    },

    leave(id) {
      if (!members.delete(id)) return false;
      for (const peerId of members.keys()) send(peerId, { t: "left", id });
      return true;
    },

    size() {
      return members.size;
    },

    has(id) {
      return members.has(id);
    },
  };
}
