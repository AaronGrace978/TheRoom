import assert from "node:assert/strict";
import test from "node:test";
import { candidateStaysInRoom, isPrivateAddress } from "../public/js/privacy.js";

test("private networks stay, public addresses do not", () => {
  for (const address of ["127.0.0.1", "10.0.0.8", "192.168.1.20", "172.16.0.4", "172.31.255.1", "169.254.3.3", "::1", "fe80::1", "fd00::5"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  for (const address of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "11.0.0.1", "255.255.255.255", "", "example.com"]) {
    assert.equal(isPrivateAddress(address), false, address);
  }
  assert.equal(isPrivateAddress("::ffff:192.168.0.4"), true);
  assert.equal(isPrivateAddress("::ffff:8.8.8.8"), false);
});

test("only host candidates that name this room are kept", () => {
  assert.equal(
    candidateStaysInRoom("candidate:1 1 udp 2122252543 192.168.1.9 53947 typ host generation 0"),
    true,
  );
  assert.equal(
    candidateStaysInRoom("candidate:2 1 udp 2122252543 a1b2c3d4.local 53947 typ host generation 0"),
    true,
  );
  assert.equal(
    candidateStaysInRoom("candidate:3 1 udp 1686052607 8.8.8.8 53947 typ srflx raddr 0.0.0.0 rport 0"),
    false,
  );
  assert.equal(
    candidateStaysInRoom("candidate:4 1 udp 41885439 8.8.8.8 53947 typ host"),
    false,
  );
  assert.equal(candidateStaysInRoom("not a candidate"), false);
});
