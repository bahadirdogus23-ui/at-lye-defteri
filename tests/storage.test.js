import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import {
  openDB,
  append,
  encryptBackup,
  decryptBackup,
  restore,
} from "../src/storage";
const e = {
  id: "a",
  entity: "a",
  kind: "stock",
  parents: [],
  actor: "a",
  actorName: "Ali",
  at: "2026-01-01T12:00:00Z",
  data: { name: "MDF", unit: "Adet", quantity: 25, active: true },
};
it("IndexedDB çevrimdışı kaydı kapanıp açılınca korur", async () => {
  const name = crypto.randomUUID();
  const db = openDB(name);
  await append(db, e);
  db.close();
  const again = openDB(name);
  expect(await again.events.get("a")).toEqual(e);
  await again.delete();
});
it("AES-GCM yedeği yanlış parola, bozulma ve farklı işletmede reddedilir", async () => {
  const file = await encryptBackup([e], "çok-güvenli-parola", "local");
  expect(JSON.stringify(file)).not.toContain("MDF");
  expect(await decryptBackup(file, "çok-güvenli-parola", "local")).toEqual([e]);
  await expect(
    decryptBackup(file, "yanlış-parola-123", "local"),
  ).rejects.toThrow();
  await expect(
    decryptBackup(file, "çok-güvenli-parola", "other"),
  ).rejects.toThrow();
  await expect(
    decryptBackup(
      { ...file, ciphertext: file.ciphertext.slice(4) },
      "çok-güvenli-parola",
      "local",
    ),
  ).rejects.toThrow();
});
it("geri yükleme öncesi şifreli kopya alır, kaydı birleştirir, tekrarda çoğaltmaz", async () => {
  const db = openDB(crypto.randomUUID());
  await append(db, e);
  const b = { ...e, id: "b", entity: "b", data: { ...e.data, name: "Ray" } };
  const file = await encryptBackup([b], "çok-güvenli-parola", "local");
  const r = await restore(db, file, "çok-güvenli-parola", "local");
  expect(r).toEqual({ before: 1, after: 2, imported: 1 });
  expect(await db.backups.count()).toBe(1);
  const safety = (await db.backups.toArray())[0];
  expect(
    await decryptBackup(safety.file, "çok-güvenli-parola", "local"),
  ).toEqual([e]);
  expect((await restore(db, file, "çok-güvenli-parola", "local")).after).toBe(
    2,
  );
  expect(await db.events.count()).toBe(2);
  await db.delete();
});
it("bozuk yedek mevcut veriye dokunmaz", async () => {
  const db = openDB(crypto.randomUUID());
  await append(db, e);
  await expect(
    restore(db, { version: 1 }, "çok-güvenli-parola", "local"),
  ).rejects.toThrow();
  expect(await db.events.count()).toBe(1);
  expect(await db.backups.count()).toBe(0);
  await db.delete();
});
