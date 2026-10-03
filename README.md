# The Room

Nearby devices find each other on the LAN (mDNS + WebRTC, no server, nothing leaves the room). Each phone becomes one candle. When the group's breathing settles toward the same slow rhythm, the candles brighten together. Then it fades to black. Nothing saved, nothing uploaded.

## Enter

On the machine that will stay in the room:

```bash
npm install
npm start
```

Open the address it prints. On this machine that is `http://localhost:4545`. From another phone on the same Wi-Fi, use the address beside “in the room”, or `http://the-room.local:4545` where multicast works.

A second address, `https://the-room.local:4546`, exists for phones whose browsers will only open a private connection through WebRTC on a secure page. The certificate is made in memory when the room is lit and is gone when the process stops. The browser will say it does not know this room. There is no outside authority to ask.

Hold the glass as you breathe in. Let go as you breathe out. Each phone is one candle. When two or more of those breaths settle near the same slow cycle — about one breath every ten seconds — the room warms, brightens, and goes dark.

After that, nothing is kept. You can light the candle again. That is a new room, not a record of the last one.

## What stays here

- The only process is a hearth on the local network. It introduces the phones, then forgets them. It does not write the evening down.
- Phones speak their breath to each other over WebRTC data channels. There is no STUN server and no TURN server. A candidate that is not a private address, or a local mDNS name, is dropped.
- The hearth refuses a connection that does not come from a private address.
- What travels is a number for the breath: how full, how long, where in the cycle. Never a recording, never a name.
- The page stores nothing. No `localStorage`, no account, no analytics. The type is set in a font that ships with the room, so the glass does not reach out for one.

The microphone is never asked for. The breath is your hand on the glass, which is quiet, and which leaves when you lift it.
