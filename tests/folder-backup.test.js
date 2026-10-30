import { it, expect, vi } from "vitest";
import { writeFolderBackup } from "../src/folder-backup";
import { decryptBackup } from "../src/backup";
const event = {
  id: "stock",
  entity: "stock",
  kind: "stock",
  parents: [],
  actor: "local-user",
  actorName: "Yerel",
  at: "2026-01-01T00:00:00Z",
  data: { name: "MDF", unit: "Adet", quantity: 25, active: true },
};
function directory(permission = "granted") {
  const writer = { write: vi.fn(), close: vi.fn(), abort: vi.fn() };
  const handle = {
    queryPermission: vi.fn(async () => permission),
    getFileHandle: vi.fn(async () => ({ createWritable: async () => writer })),
  };
  return { handle, writer };
}
it("seçilen klasöre şifreli tam yedek yazar, aynı veri için tekrar dosya oluşturmaz", async () => {
  const { handle, writer } = directory();
  const result = await writeFolderBackup(
    handle,
    [event],
    "guvenli-yedek-parolasi",
    "local",
  );
  expect(result.name).toMatch(/^atolye-yerel-.*\.json$/);
  expect(writer.close).toHaveBeenCalledOnce();
  const file = JSON.parse(writer.write.mock.calls[0][0]);
  expect(await decryptBackup(file, "guvenli-yedek-parolasi", "local")).toEqual([
    event,
  ]);
  const next = await writeFolderBackup(
    handle,
    [event],
    "guvenli-yedek-parolasi",
    "local",
    result.signature,
  );
  expect(next.unchanged).toBe(true);
  expect(handle.getFileHandle).toHaveBeenCalledOnce();
});
it("izin olmadan otomatik izin penceresi açmaz ve başarı bildirmez", async () => {
  const { handle } = directory("prompt");
  await expect(
    writeFolderBackup(handle, [event], "guvenli-yedek-parolasi", "local"),
  ).rejects.toThrow("yazma izni");
  expect(handle.getFileHandle).not.toHaveBeenCalled();
});
it("yazma başarısızsa işlemi iptal eder", async () => {
  const { handle, writer } = directory();
  writer.write.mockRejectedValue(Error("Disk dolu"));
  await expect(
    writeFolderBackup(handle, [event], "guvenli-yedek-parolasi", "local"),
  ).rejects.toThrow("Disk dolu");
  expect(writer.abort).toHaveBeenCalledOnce();
  expect(writer.close).not.toHaveBeenCalled();
});
it("değişiklikte eski dosyanın üstüne yazmak yerine yeni dosya oluşturur", async () => {
  const { handle } = directory();
  const first = await writeFolderBackup(
    handle,
    [event],
    "guvenli-yedek-parolasi",
    "local",
  );
  const second = await writeFolderBackup(
    handle,
    [
      event,
      {
        ...event,
        id: "v2",
        parents: ["stock"],
        data: { ...event.data, quantity: 20 },
      },
    ],
    "guvenli-yedek-parolasi",
    "local",
    first.signature,
  );
  expect(second.name).not.toBe(first.name);
  expect(handle.getFileHandle).toHaveBeenCalledTimes(2);
});
