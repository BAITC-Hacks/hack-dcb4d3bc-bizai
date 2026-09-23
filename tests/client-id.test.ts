import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createClientId } from "../lib/client-id";

test("client IDs satisfy the API UUID contract without secure-context randomUUID", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto")!;
  const getRandomValues = crypto.getRandomValues.bind(crypto);
  try {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues } });
    const ids = Array.from({ length: 100 }, createClientId);
    for (const id of ids) {
      assert.equal(z.uuid().parse(id), id);
      assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    assert.equal(new Set(ids).size, ids.length);
  } finally {
    Object.defineProperty(globalThis, "crypto", original);
  }
});

test("client IDs also work with native randomUUID", () => {
  assert.equal(z.uuid().safeParse(createClientId()).success, true);
});
