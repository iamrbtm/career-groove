import test from "node:test";
import assert from "node:assert/strict";
import { windowKey, limitMax } from "@/lib/rate-limit";

test("windowKey buckets by fixed time window", () => {
  const windowMs = 3_600_000;
  const t0 = 3_600_000 * 472223;
  assert.equal(windowKey("ai:user-1", t0, windowMs), `rl:ai:user-1:${Math.floor(t0 / windowMs)}`);
  assert.equal(windowKey("ai:user-1", t0 + windowMs - 1, windowMs), windowKey("ai:user-1", t0, windowMs));
});

test("windowKey shifts to next bucket after boundary", () => {
  const windowMs = 1_000;
  const t0 = 2_000_000_000_000;
  assert.notEqual(windowKey("k", t0 + windowMs, windowMs), windowKey("k", t0, windowMs));
});

test("windowKey separates prefixes and callers", () => {
  assert.notEqual(windowKey("ai:u1", 0, 1000), windowKey("ai:u2", 0, 1000));
  assert.notEqual(windowKey("ai:u1", 0, 1000), windowKey("register:u1", 0, 1000));
  assert.match(windowKey("register:1.2.3.4", 5_000, 60_000), /^rl:register:1\.2\.3\.4:0$/);
});

test("limitMax falls back when env unset or invalid", () => {
  const saved = process.env.RATE_LIMIT_TEST;
  delete process.env.RATE_LIMIT_TEST;
  assert.equal(limitMax("RATE_LIMIT_TEST", 60), 60);
  process.env.RATE_LIMIT_TEST = "0";
  assert.equal(limitMax("RATE_LIMIT_TEST", 60), 60);
  process.env.RATE_LIMIT_TEST = "-5";
  assert.equal(limitMax("RATE_LIMIT_TEST", 60), 60);
  process.env.RATE_LIMIT_TEST = "abc";
  assert.equal(limitMax("RATE_LIMIT_TEST", 60), 60);
  if (saved === undefined) delete process.env.RATE_LIMIT_TEST;
  else process.env.RATE_LIMIT_TEST = saved;
});

test("limitMax honors positive env override", () => {
  const saved = process.env.RATE_LIMIT_TEST;
  process.env.RATE_LIMIT_TEST = "7";
  assert.equal(limitMax("RATE_LIMIT_TEST", 60), 7);
  if (saved === undefined) delete process.env.RATE_LIMIT_TEST;
  else process.env.RATE_LIMIT_TEST = saved;
});
