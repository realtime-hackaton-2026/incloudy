import { defineConfig } from "@portalsdk/config";

export default defineConfig({
  channels: {
    "case-*": {
      mode: "standard",
      anonymous: false,
    },
  },
});
