import test from "node:test";
import assert from "node:assert/strict";

function stripJsonFences(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/i, "");
  return cleaned.trim();
}

test("stripJsonFences cleans markdown json fences properly", () => {
  const input = "```json\n{\n  \"status\": \"healthy\"\n}\n```";
  const output = stripJsonFences(input);
  assert.equal(output, '{\n  "status": "healthy"\n}');
  assert.deepEqual(JSON.parse(output), { status: "healthy" });
});

test("stripJsonFences handles plain JSON without fences", () => {
  const input = '{"status": "ok"}';
  const output = stripJsonFences(input);
  assert.equal(output, '{"status": "ok"}');
  assert.deepEqual(JSON.parse(output), { status: "ok" });
});

test("Gemini API key resolution includes all fallback aliases", () => {
  const mockEnv = {
    GEMINI_API_KEY: "test-mock-api-key-1234567890",
  };
  const key =
    mockEnv.GOOGLE_GENERATIVE_AI_API_KEY ||
    mockEnv.GEMINI_API_KEY ||
    mockEnv.NEXT_PUBLIC_GEMINI_API_KEY;

  assert.ok(key);
  assert.equal(key, "test-mock-api-key-1234567890");
});
