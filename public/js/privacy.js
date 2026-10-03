// Addresses that can belong to this room. Anything else is turned away,
// including at the WebRTC layer, so a candidate cannot wander outside.

export function isPrivateAddress(address) {
  if (!address) return false;
  let ip = String(address).trim().toLowerCase();
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  const zone = ip.indexOf("%");
  if (zone !== -1) ip = ip.slice(0, zone);

  if (ip === "::1" || ip === "localhost") return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;

  const private172 = ip.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (private172) {
    const second = Number(private172[1]);
    if (second >= 16 && second <= 31) return true;
  }

  if (ip.startsWith("fe80:")) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  return false;
}

// Host candidates only, and only when they name this network
// (a private address, or the mDNS name a browser uses in place of one).
export function candidateStaysInRoom(candidate) {
  if (typeof candidate !== "string" || candidate.length > 1000) return false;
  const parts = candidate.trim().split(/\s+/);
  const typAt = parts.indexOf("typ");
  if (typAt < 0 || parts[typAt + 1] !== "host") return false;
  const address = parts[4];
  if (!address || address.length > 255) return false;
  if (address.toLowerCase().endsWith(".local")) return true;
  return isPrivateAddress(address);
}
