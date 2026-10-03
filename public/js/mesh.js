import { candidateStaysInRoom } from "./privacy.js";

// Breath travels on a data channel. There is no STUN and no TURN:
// if the two phones cannot see each other on this network, they do not meet.

function emptySoul() {
  return { fullness: 0.15, phase: 0, period: 0, cycles: 0, updated: 0 };
}

export function createMesh(myId, { send, onDawn }) {
  const peers = new Map();
  let closed = false;

  function attach(peer, channel) {
    peer.dc = channel;
    channel.binaryType = "arraybuffer";
    channel.onmessage = (event) => {
      if (typeof event.data !== "string" || event.data.length > 400) return;
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!message || typeof message !== "object") return;
      if (message.k === "b") {
        const fullness = Number(message.v);
        const phase = Number(message.p);
        const period = Number(message.t);
        const cycles = Number(message.c);
        peer.soul = {
          fullness: Number.isFinite(fullness) ? Math.min(1, Math.max(0, fullness)) : 0,
          phase: Number.isFinite(phase) ? ((phase % 1) + 1) % 1 : 0,
          period: Number.isFinite(period) ? Math.min(30000, Math.max(0, period)) : 0,
          cycles: Number.isFinite(cycles) ? Math.max(0, cycles) : 0,
          updated: performance.now(),
        };
      } else if (message.k === "dawn") {
        onDawn();
      }
    };
  }

  function ensure(remoteId) {
    if (closed || !remoteId || remoteId === myId) return null;
    const existing = peers.get(remoteId);
    if (existing) return existing;

    let pc;
    try {
      pc = new RTCPeerConnection({
        iceServers: [],
        iceCandidatePoolSize: 0,
        bundlePolicy: "max-bundle",
      });
    } catch {
      return null;
    }

    const peer = { id: remoteId, pc, dc: null, soul: emptySoul(), presence: 0, born: performance.now(), gone: false };
    peers.set(remoteId, peer);

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const line = event.candidate.candidate;
      if (!candidateStaysInRoom(line)) return;
      send(remoteId, { candidate: event.candidate.toJSON() });
    };

    pc.ondatachannel = (event) => attach(peer, event.channel);
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "failed" || state === "closed") peer.gone = true;
    };

    if (myId < remoteId) {
      try {
        attach(peer, pc.createDataChannel("breath", { ordered: false, maxRetransmits: 0 }));
        offer(peer);
      } catch {
        peer.gone = true;
      }
    }
    return peer;
  }

  async function offer(peer) {
    try {
      const description = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(description);
      send(peer.id, { description: peer.pc.localDescription });
    } catch {
      peer.gone = true;
    }
  }

  async function onSignal(from, data) {
    if (closed || !data) return;
    const peer = ensure(from);
    if (!peer) return;
    try {
      if (data.description) {
        await peer.pc.setRemoteDescription(data.description);
        if (data.description.type === "offer") {
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          send(from, { description: peer.pc.localDescription });
        }
      } else if (data.candidate && candidateStaysInRoom(data.candidate.candidate)) {
        await peer.pc.addIceCandidate(data.candidate);
      }
    } catch {
      peer.gone = true;
    }
  }

  function forget(id) {
    const peer = peers.get(id);
    if (!peer) return;
    peer.gone = true;
  }

  function broadcast(sample) {
    const payload = JSON.stringify({
      k: "b",
      v: Math.round(sample.fullness * 1000) / 1000,
      p: Math.round(sample.phase * 1000) / 1000,
      t: Math.round(sample.period),
      c: sample.cycles | 0,
    });
    for (const peer of peers.values()) {
      if (peer.dc && peer.dc.readyState === "open") {
        try {
          peer.dc.send(payload);
        } catch {
          peer.gone = true;
        }
      }
    }
  }

  function announceDawn() {
    const payload = JSON.stringify({ k: "dawn" });
    for (const peer of peers.values()) {
      if (peer.dc && peer.dc.readyState === "open") {
        try {
          peer.dc.send(payload);
        } catch {
          // the dark still comes locally
        }
      }
    }
  }

  function tick(dt) {
    const now = performance.now();
    for (const [id, peer] of peers) {
      const fresh = now - peer.soul.updated < 2200 && peer.dc?.readyState === "open";
      const target = peer.gone || (!fresh && now - peer.born > 8000) ? 0 : 1;
      peer.presence += (target - peer.presence) * (1 - Math.exp(-dt * 2.4));
      if ((peer.gone || !fresh) && peer.presence < 0.02 && (peer.gone || now - peer.soul.updated > 6000)) {
        try {
          peer.dc?.close();
        } catch {
          // already closed
        }
        try {
          peer.pc.close();
        } catch {
          // already closed
        }
        peers.delete(id);
      }
    }
  }

  function souls() {
    const now = performance.now();
    const list = [];
    for (const peer of peers.values()) {
      const fresh = now - peer.soul.updated < 2000 && peer.dc?.readyState === "open";
      list.push({ ...peer.soul, fresh, id: peer.id });
    }
    return list;
  }

  function visuals() {
    const list = [];
    for (const peer of peers.values()) {
      if (peer.presence < 0.01) continue;
      list.push({
        id: peer.id,
        fullness: peer.soul.fullness,
        presence: peer.presence,
      });
    }
    list.sort((a, b) => (a.id < b.id ? -1 : 1));
    return list;
  }

  function close() {
    closed = true;
    for (const peer of peers.values()) {
      try {
        peer.dc?.close();
      } catch {
        // already closed
      }
      try {
        peer.pc.close();
      } catch {
        // already closed
      }
    }
    peers.clear();
  }

  return {
    ensure,
    onSignal,
    forget,
    broadcast,
    announceDawn,
    tick,
    souls,
    visuals,
    close,
    count() {
      return peers.size;
    },
  };
}
