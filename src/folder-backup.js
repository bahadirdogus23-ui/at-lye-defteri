import { encryptBackup } from "./backup.js";
import { canonical } from "./domain.js";
export async function writeFolderBackup(
  handle,
  events,
  password,
  scope,
  previousSignature,
) {
  if ((await handle.queryPermission({ mode: "readwrite" })) !== "granted")
    throw Error(
      "Klasör yazma izni gerekli. “Klasör iznini yenile” düğmesine basın.",
    );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(events)),
  );
  const signature = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  if (signature === previousSignature) return { unchanged: true, signature };
  const file = await encryptBackup(events, password, scope);
  const at = new Date().toISOString();
  const name = `atolye-${scope === "local" ? "yerel" : scope}-${at.replaceAll(":", "-")}-${crypto.randomUUID().slice(0, 8)}.json`;
  const entry = await handle.getFileHandle(name, { create: true });
  const writer = await entry.createWritable();
  try {
    await writer.write(JSON.stringify(file));
    await writer.close();
  } catch (error) {
    try {
      await writer.abort();
    } catch {}
    throw error;
  }
  return { at, signature, name };
}
