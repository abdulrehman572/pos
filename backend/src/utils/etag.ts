import { createHash } from "crypto";

export function etag(data: string): string {
  return createHash("md5").update(data).digest("hex");
}