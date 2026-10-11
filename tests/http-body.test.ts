import test from "node:test";
import assert from "node:assert/strict";
import { JsonBodyError, readJsonBody } from "@/server/http";

function jsonRequest(value: string, headers: Record<string, string> = { "content-type": "application/json" }) {
  return new Request("http://localhost/test", { method: "POST", headers, body: value });
}

test("bounded JSON reader parses a small JSON object", async () => {
  const body = await readJsonBody(jsonRequest(JSON.stringify({ text: "hello" })), 1024);
  assert.deepEqual(body, { text: "hello" });
});

test("bounded JSON reader rejects a body that exceeds its byte budget", async () => {
  await assert.rejects(
    readJsonBody(jsonRequest(JSON.stringify({ text: "x".repeat(2048) })), 100),
    (error: unknown) => error instanceof JsonBodyError && error.code === "BODY_TOO_LARGE",
  );
});

test("bounded JSON reader rejects unsupported content types", async () => {
  await assert.rejects(
    readJsonBody(jsonRequest("{}", { "content-type": "text/plain" })),
    (error: unknown) => error instanceof JsonBodyError && error.code === "UNSUPPORTED_CONTENT_TYPE",
  );
});

test("bounded JSON reader rejects malformed JSON", async () => {
  await assert.rejects(
    readJsonBody(jsonRequest("{bad json")),
    (error: unknown) => error instanceof JsonBodyError && error.code === "INVALID_JSON",
  );
});
