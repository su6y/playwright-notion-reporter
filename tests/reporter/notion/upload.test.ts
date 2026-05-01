import { describe, it, expect, vi } from "vitest";
import { uploadScreenshot } from "../../../src/reporter/notion/upload.ts";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("fake-png")),
}));

function makeClient() {
  return {
    fileUploads: {
      create: vi.fn().mockResolvedValue({ id: "upload-1" }),
      send: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("uploadScreenshot", () => {
  it("returns the upload id", async () => {
    const client = makeClient();
    const id = await uploadScreenshot(client as any, "/tmp/shot.png");
    expect(id).toBe("upload-1");
  });

  it("calls create with correct filename", async () => {
    const client = makeClient();
    await uploadScreenshot(client as any, "/path/to/screenshot.png");
    expect(client.fileUploads.create).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "screenshot.png" }),
    );
  });

  it("sends file data with upload id", async () => {
    const client = makeClient();
    await uploadScreenshot(client as any, "/tmp/shot.png");
    expect(client.fileUploads.send).toHaveBeenCalledWith(
      expect.objectContaining({ file_upload_id: "upload-1" }),
    );
  });
});
