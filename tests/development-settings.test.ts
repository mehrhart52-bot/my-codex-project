import { test } from "node:test";
import assert from "node:assert/strict";
import { developmentSettings } from "../scripts/development-settings.mjs";

const demoUrl = "https://naxlbpsjoonktjbieyft.supabase.co";

test("a fresh download starts with the shared demo public settings", () => {
  const settings = developmentSettings(undefined, undefined);
  assert.equal(settings.url, demoUrl);
  assert.equal(settings.sharedDemo, true);
  assert.match(settings.key, /^sb_publishable_/);
});

test("the shared demo uses the verified public key despite an old or missing key", () => {
  const expected = developmentSettings(undefined, undefined);
  for (const key of [undefined, "", "sb_publishable_incomplete", "old-key"]) {
    assert.deepEqual(developmentSettings(demoUrl, key), expected);
    assert.deepEqual(developmentSettings(` ${demoUrl}/ `, key), expected);
  }
});

test("another project's settings and incomplete configuration are preserved", () => {
  assert.deepEqual(
    developmentSettings(" https://other.supabase.co/ ", " own-key "),
    {
      url: "https://other.supabase.co",
      key: "own-key",
      sharedDemo: false,
    },
  );
  assert.equal(
    developmentSettings("http://127.0.0.1:54321", "lab-key").key,
    "lab-key",
  );
  assert.equal(developmentSettings(undefined, "own-key").sharedDemo, false);
  assert.equal(
    developmentSettings("https://other.supabase.co", undefined).sharedDemo,
    false,
  );
});
