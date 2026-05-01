import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendToNotion } from "../../../src/reporter/notion/client.ts";
import type { PlaywrightStats } from "../../../src/types.ts";
import { makeEntry } from "./helpers.ts";

const mockWarning = vi.fn();
vi.mock("@actions/core", () => ({ warning: (...args: unknown[]) => mockWarning(...args) }));

const mockPageCreate = vi.fn().mockResolvedValue({ id: "page-id" });
const mockAppend = vi.fn().mockResolvedValue({});
const mockDbRetrieve = vi.fn().mockResolvedValue({
  data_sources: [{ id: "ds-id" }],
});
const mockDsRetrieve = vi.fn().mockResolvedValue({
  properties: { 名前: { type: "title" } },
});
const mockDsUpdate = vi.fn().mockResolvedValue({});
const mockFileCreate = vi.fn().mockResolvedValue({ id: "upload-id" });
const mockFileSend = vi.fn().mockResolvedValue({});

const mockViewsList = vi.fn().mockResolvedValue({ results: [{ id: "view-id" }] });
const mockViewsUpdate = vi.fn().mockResolvedValue({});

vi.mock("@notionhq/client", () => ({
  Client: class {
    pages = { create: mockPageCreate };
    blocks = { children: { append: mockAppend } };
    databases = { retrieve: mockDbRetrieve };
    dataSources = { retrieve: mockDsRetrieve, update: mockDsUpdate };
    fileUploads = { create: mockFileCreate, send: mockFileSend };
    views = { list: mockViewsList, update: mockViewsUpdate };
  },
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("fake")),
}));

const STATS: PlaywrightStats = {
  startTime: "2026-01-01T00:00:00.000Z",
  duration: 5000,
  expected: 2,
  unexpected: 1,
  skipped: 0,
  flaky: 0,
};

describe("sendToNotion", () => {
  beforeEach(() => {
    mockPageCreate.mockClear().mockResolvedValue({ id: "page-id" });
    mockAppend.mockClear().mockResolvedValue({});
    mockDsUpdate.mockClear();
    mockFileCreate.mockClear().mockResolvedValue({ id: "upload-id" });
    mockFileSend.mockClear().mockResolvedValue({});
    mockWarning.mockClear();
  });

  it("creates a single page for the test run", async () => {
    await sendToNotion("token", "db-id", STATS, [
      makeEntry(),
      makeEntry({ title: "should fail", status: "failed", error: "Error" }),
    ]);

    expect(mockPageCreate).toHaveBeenCalledOnce();
    const call = mockPageCreate.mock.calls[0]![0];
    expect(call.parent.data_source_id).toBe("ds-id");
    expect(call.properties["名前"].title[0].mention.date.start).toBe(STATS.startTime);
    expect(call.icon).toEqual({ type: "emoji", emoji: "❌" });
    expect(call.properties.Passed.number).toBe(2);
    expect(call.properties.Failed.number).toBe(1);
  });

  it("includes test blocks as page children", async () => {
    await sendToNotion("token", "db-id", STATS, [makeEntry()]);

    const call = mockPageCreate.mock.calls[0]![0];
    const children = call.children;
    expect(children.length).toBeGreaterThanOrEqual(3);
    expect(children[0].type).toBe("heading_3");
  });

  it("includes error code block for failed tests", async () => {
    await sendToNotion("token", "db-id", STATS, [
      makeEntry({ status: "failed", error: "Error: timeout" }),
    ]);

    const children = mockPageCreate.mock.calls[0]![0].children;
    const codeBlock = children.find((b: Record<string, unknown>) => b.type === "code");
    expect(codeBlock).toBeDefined();
  });

  it("auto-creates missing database properties", async () => {
    await sendToNotion("token", "db-id", STATS, [makeEntry()]);

    expect(mockDsUpdate).toHaveBeenCalledOnce();
    const props = mockDsUpdate.mock.calls[0]![0].properties;
    expect(props).toHaveProperty("Status");
    expect(props).toHaveProperty("Passed");
    expect(props).toHaveProperty("Failed");
  });

  it("uploads screenshot and includes image block", async () => {
    await sendToNotion("token", "db-id", STATS, [makeEntry({ screenshotPath: "/tmp/shot.png" })]);

    expect(mockFileCreate).toHaveBeenCalledOnce();
    const children = mockPageCreate.mock.calls[0]![0].children;
    const image = children.find((b: Record<string, unknown>) => b.type === "image");
    expect(image).toBeDefined();
  });

  it("warns on screenshot upload failure", async () => {
    mockFileCreate.mockRejectedValueOnce(new Error("upload failed"));

    await sendToNotion("token", "db-id", STATS, [makeEntry({ screenshotPath: "/tmp/shot.png" })]);

    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining("upload failed"));
  });

  it("deduplicates screenshot uploads for same path", async () => {
    await sendToNotion("token", "db-id", STATS, [
      makeEntry({ screenshotPath: "/tmp/shot.png" }),
      makeEntry({ title: "other", screenshotPath: "/tmp/shot.png" }),
    ]);

    expect(mockFileCreate).toHaveBeenCalledOnce();
  });

  it("warns on blocks.children.append failure", async () => {
    // Generate >100 blocks to trigger append (each entry = ~3-4 blocks + divider)
    const entries = Array.from({ length: 30 }, (_, i) =>
      makeEntry({ title: `test-${i}`, error: "err" }),
    );
    mockAppend.mockRejectedValueOnce(new Error("rate limited"));

    await sendToNotion("token", "db-id", STATS, entries);

    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining("Failed to append blocks"));
  });

  it("sets status to passed when no unexpected failures", async () => {
    const passingStats: PlaywrightStats = { ...STATS, unexpected: 0 };
    await sendToNotion("token", "db-id", passingStats, [makeEntry()]);

    const props = mockPageCreate.mock.calls[0]![0].properties;
    expect(props.Status.select.name).toBe("passed");
  });
});
