import type { Client } from "@notionhq/client";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export async function uploadScreenshot(client: Client, filePath: string): Promise<string> {
  const upload = await client.fileUploads.create({
    mode: "single_part",
    filename: basename(filePath),
    content_type: "image/png",
  });

  const fileData = await readFile(filePath);
  await client.fileUploads.send({
    file_upload_id: upload.id,
    file: {
      data: new Blob([fileData], { type: "image/png" }),
      filename: basename(filePath),
    },
  });

  return upload.id;
}
