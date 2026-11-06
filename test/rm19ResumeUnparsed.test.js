// 44y — the tools service's contract 1.9.0 refuses a base résumé whose section headings it cannot read (422
// resume_unparsed, retryable false, permanent true) instead of answering 200 with the header alone (44x's walk).
// draft must say what happened — the user's headings — not "down on our side", and must not invite a retry.
import test from "node:test";
import assert from "node:assert/strict";
import { httpErrorFor, ToolsServiceError, USER_GENERATION_MESSAGES } from "../services/toolsService.js";

const unparsed = () => new ToolsServiceError("No section heading in the base résumé could be read …",
  { code: "resume_unparsed", status: 422, retryable: false, permanent: true });

test("44y · resume_unparsed answers 422 with the headings message, not retryable, never the 'down' message", () => {
  const { status, body } = httpErrorFor(unparsed());
  assert.equal(status, 422);
  assert.equal(body.code, "resume_unparsed");
  assert.equal(body.retryable, false);
  assert.equal(body.error, USER_GENERATION_MESSAGES.unparsed);
  assert.match(body.error, /section headings/);
  assert.match(body.error, /no draft was used/);
  assert.notEqual(body.error, USER_GENERATION_MESSAGES.down);
  assert.doesNotMatch(body.error, /try again shortly|No section heading/, "the tools service's own words never reach the user");
});

test("44y · other permanent tools-service failures still say 'down on our side'", () => {
  const { status, body } = httpErrorFor(new ToolsServiceError("x", { code: "upstream_model_failure", status: 502, retryable: false, permanent: true }));
  assert.equal(status, 503);
  assert.equal(body.error, USER_GENERATION_MESSAGES.down);
});
