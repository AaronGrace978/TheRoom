export function createNet(myId, mesh) {
  let socket = null;
  let stopped = false;
  let connected = false;
  let attempt = 0;
  let timer = 0;

  function address() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${location.host}/room`;
  }

  function connect() {
    if (stopped || !location.host) return;
    let next;
    try {
      next = new WebSocket(address());
    } catch {
      schedule();
      return;
    }
    socket = next;
    next.addEventListener("open", () => {
      attempt = 0;
      connected = true;
      next.send(JSON.stringify({ t: "hello", id: myId }));
    });
    next.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!message || typeof message !== "object") return;
      if (message.t === "welcome" && Array.isArray(message.peers)) {
        for (const id of message.peers) mesh.ensure(id);
      } else if (message.t === "joined" && typeof message.id === "string") {
        mesh.ensure(message.id);
      } else if (message.t === "left" && typeof message.id === "string") {
        mesh.forget(message.id);
      } else if (message.t === "signal" && message.data) {
        mesh.onSignal(message.from, message.data);
      }
    });
    next.addEventListener("close", () => {
      connected = false;
      if (!stopped) schedule();
    });
    next.addEventListener("error", () => {});
  }

  function schedule() {
    attempt += 1;
    const wait = Math.min(8000, 500 * attempt);
    clearTimeout(timer);
    timer = setTimeout(connect, wait);
  }

  function sendSignal(to, data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ t: "signal", to, data }));
    }
  }

  function forget() {
    stopped = true;
    clearTimeout(timer);
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ t: "forget" }));
      } catch {
        // already leaving
      }
      socket.close(1000);
    } else if (socket) {
      socket.close();
    }
    socket = null;
    connected = false;
  }

  return {
    connect,
    sendSignal,
    forget,
    get connected() {
      return connected;
    },
  };
}
