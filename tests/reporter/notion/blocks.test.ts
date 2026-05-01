import { describe, it, expect } from "vitest";
import { buildPageBlocks, statusEmoji, truncate } from "../../../src/reporter/notion/blocks.ts";
import { makeEntry } from "./helpers.ts";

describe("statusEmoji", () => {
  it.each([
    ["passed", "✅"],
    ["failed", "❌"],
    ["timedOut", "⏰"],
    ["skipped", "⏭️"],
    ["interrupted", "❓"],
  ])("returns correct emoji for %s", (status, emoji) => {
    expect(statusEmoji(status)).toBe(emoji);
  });
});

describe("truncate", () => {
  it("returns text as-is when within limit", () => {
    expect(truncate("short")).toBe("short");
  });

  it("truncates long text with ellipsis", () => {
    const result = truncate("abcdefghij", 8);
    expect(result).toBe("abcde...");
    expect(result.length).toBe(8);
  });

  it("strips ANSI escape codes", () => {
    expect(truncate("\u001b[31mred\u001b[0m")).toBe("red");
  });
});

describe("buildPageBlocks", () => {
  it("includes error code block for failed test", () => {
    const blocks = buildPageBlocks([makeEntry({ error: "Error: fail" })], new Map());
    const code = blocks.find((b: any) => b.type === "code");
    expect(code).toBeDefined();
  });

  it("omits error code block when no error", () => {
    const blocks = buildPageBlocks([makeEntry()], new Map());
    const code = blocks.find((b: any) => b.type === "code");
    expect(code).toBeUndefined();
  });

  it("includes image block when screenshot uploaded", () => {
    const ids = new Map([["shot.png", "upload-123"]]);
    const blocks = buildPageBlocks([makeEntry({ screenshotPath: "shot.png" })], ids);
    const image = blocks.find((b: any) => b.type === "image");
    expect(image).toBeDefined();
  });

  it("omits image block when no screenshot", () => {
    const blocks = buildPageBlocks([makeEntry()], new Map());
    const image = blocks.find((b: any) => b.type === "image");
    expect(image).toBeUndefined();
  });
});
