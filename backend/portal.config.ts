import { defineConfig } from "@portalsdk/config";

const webhookUrl = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env?.PORTAL_WEBHOOK_URL;

export default defineConfig({
  ...(webhookUrl ? { webhooks: { url: webhookUrl } } : {}),
  channels: {
    "case-*": {
      mode: "standard",
      anonymous: false,
    },
  },
});
