import { it, expect } from "vitest";
import { backupHandler } from "../src/server-backup";
import { decryptBackup } from "../src/backup";
const env = {
  ATOLYE_BACKUP_TRIGGER_KEY: "a-long-random-server-trigger",
  ATOLYE_BACKUP_PASSPHRASE: "a-separate-long-backup-password",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-not-a-key",
};
it("zamanlanmış sunucu işi yalnızca doğrulanmış çağrıda şifreli tam yedek üretir", async () => {
  let output;
  const handler = backupHandler(
    (n) => env[n],
    async (url, options) => {
      if (url.includes("workspaces?"))
        return Response.json([{ id: "workspace" }]);
      if (url.includes("rpc/read_ledger")) return Response.json([]);
      output = JSON.parse(options.body);
      return new Response(null, { status: 201 });
    },
  );
  const request = () =>
    new Request("https://example/backup", {
      method: "POST",
      headers: { "x-backup-key": env.ATOLYE_BACKUP_TRIGGER_KEY },
    });
  expect((await handler(new Request("https://example/backup"))).status).toBe(
    401,
  );
  expect(output).toBeUndefined();
  expect((await handler(request())).status).toBe(200);
  expect(
    await decryptBackup(
      output.payload,
      env.ATOLYE_BACKUP_PASSPHRASE,
      "workspace",
    ),
  ).toEqual([]);
  expect(JSON.stringify(output)).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
});
it("eksik sır ve başarısız bulut isteğinde başarı bildirmez", async () => {
  expect(
    (await backupHandler(() => undefined)(new Request("https://example")))
      .status,
  ).toBe(503);
  const handler = backupHandler(
    (n) => env[n],
    async () => new Response("failed", { status: 500 }),
  );
  expect(
    (
      await handler(
        new Request("https://example", {
          method: "POST",
          headers: { "x-backup-key": env.ATOLYE_BACKUP_TRIGGER_KEY },
        }),
      )
    ).status,
  ).toBe(500);
});
