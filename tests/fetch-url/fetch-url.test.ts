import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateIp, safeFetchUrl, UnsafeUrlError } from "@/lib/fetch-url";

test("flags private IPv4 ranges as private", () => {
  const ips = [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "172.16.0.9",
    "192.168.1.1",
    "100.64.5.5",
  ];
  for (const ip of ips) {
    assert.equal(isPrivateIp(ip), true, `expected ${ip} to be private`);
  }
});

test("flags reserved IPv4 documentation and multicast ranges", () => {
  const ips = [
    "0.1.2.3",
    "192.0.2.9",
    "192.0.0.1",
    "198.18.0.7",
    "198.51.100.4",
    "203.0.113.2",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
  ];
  for (const ip of ips) {
    assert.equal(isPrivateIp(ip), true, `expected ${ip} to be private`);
  }
});

test("allows public IPv4 ranges", () => {
  const ips = ["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "192.88.198.1"];
  for (const ip of ips) {
    assert.equal(isPrivateIp(ip), false, `expected ${ip} to be public`);
  }
});

test("treats non-canonical IPv4 literals as private", () => {
  assert.equal(isPrivateIp("2130706433"), true);
  assert.equal(isPrivateIp("0177.0.0.1"), true);
  assert.equal(isPrivateIp("0x7f.0.0.1"), true);
  assert.equal(isPrivateIp("1.2.3.4.5"), true);
  assert.equal(isPrivateIp("999.1.1.1"), true);
});

test("flags private IPv6 literals", () => {
  const ips = [
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "fec0::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:0a00:0001",
    "::a.9.9.3",
  ];
  for (const ip of ips) {
    assert.equal(isPrivateIp(ip), true, `expected ${ip} to be private`);
  }
});

test("allows public IPv6 literals", () => {
  const ips = ["2606:4700:4700::1111", "2606:47FA::1"];
  for (const ip of ips) {
    assert.equal(isPrivateIp(ip), false, `expected ${ip} to be public`);
  }
});

test("normalizes brackets and case when checking IPs", () => {
  assert.equal(isPrivateIp("[::1]"), true);
  assert.equal(isPrivateIp("[2606:4700:4700::1111]"), false);
  assert.equal(isPrivateIp("FC00::1"), true);
});

test("rejects garbage input as private (fail closed)", () => {
  assert.equal(isPrivateIp(""), true);
  assert.equal(isPrivateIp("not-an-ip"), true);
});

test("safeFetchUrl rejects non-http(s) schemes without network work", async () => {
  await assert.rejects(safeFetchUrl("ftp://example.com/file"), UnsafeUrlError);
  await assert.rejects(safeFetchUrl("file:///etc/passwd"), UnsafeUrlError);
});

test("safeFetchUrl rejects invalid URLs", async () => {
  await assert.rejects(safeFetchUrl("not a url"), UnsafeUrlError);
});

test("safeFetchUrl URL-errors carry the unsafe code", async () => {
  const error = await safeFetchUrl("ftp://example.com/").then(
    () => null,
    (err: unknown) => err,
  );
  assert.ok(error instanceof UnsafeUrlError);
  assert.equal((error as UnsafeUrlError).code, "UNSAFE_URL");
});
