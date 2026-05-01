import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  platform: "node",
  clean: true,
  deps: {
    alwaysBundle: [/@actions\/core/, /@notionhq\/client/],
  },
});
