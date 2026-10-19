import demo from "./demo-project.json" with { type: "json" };

// Used only by npm run dev. The shared fictional project has a public
// publishable key; no password, service-role key, or admin token belongs here.
// Use its known settings even when an older download has an incomplete key.
// Production and explicitly configured alternative projects use their own settings.
export function developmentSettings(url, key) {
  const normalizedUrl = url?.trim().replace(/\/+$/, "");
  const normalizedKey = key?.trim();
  if ((!normalizedUrl && !normalizedKey) || normalizedUrl === demo.url) {
    return { ...demo, sharedDemo: true };
  }
  return { url: normalizedUrl, key: normalizedKey, sharedDemo: false };
}
