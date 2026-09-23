import "server-only";
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    // Next may normalize request.url to localhost even when the browser used 127.0.0.1.
    return ["http:", "https:"].includes(url.protocol) && url.host === request.headers.get("host");
  } catch { return false; }
}
export async function readBody(request: Request) {
  const limit = 5 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > limit) throw new Error("Import exceeds 5 MB");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("Import exceeds 5 MB"); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
