import Dexie from "dexie";
import { mergeEvents, validateEvent } from "./domain";
export function openDB(scope = "local") {
  const db = new Dexie("atolye-defteri-" + scope);
  db.version(1).stores({
    events: "id,entity,kind",
    sent: "id",
    backups: "id,at",
  });
  return db;
}
export async function append(db, e) {
  validateEvent(e);
  await db.transaction("rw", db.events, async () => {
    const old = await db.events.toArray();
    mergeEvents(old, [e]);
    await db.events.add(e);
  });
}
export async function importEvents(db, events) {
  await db.transaction("rw", db.events, async () => {
    const merged = mergeEvents(await db.events.toArray(), events);
    await db.events.bulkPut(merged);
  });
}
export { encryptBackup, decryptBackup } from "./backup.js";
import { encryptBackup, decryptBackup } from "./backup.js";
export async function restore(db, file, password, scope) {
  const incoming = await decryptBackup(file, password, scope);
  const before = await db.events.toArray();
  const merged = mergeEvents(before, incoming);
  const safety = await encryptBackup(before, password, scope);
  await db.transaction("rw", db.events, db.backups, async () => {
    await db.backups.add({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      reason: "restore-before",
      file: safety,
    });
    await db.events.bulkPut(merged);
    if ((await db.events.count()) !== merged.length)
      throw Error("Geri yükleme bütünlük kontrolü başarısız.");
  });
  return {
    before: before.length,
    after: merged.length,
    imported: merged.length - before.length,
  };
}
