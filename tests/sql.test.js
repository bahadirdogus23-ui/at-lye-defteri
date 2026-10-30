import "fake-indexeddb/auto";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
let db;
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333",
  w = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const event = (id = "44444444-4444-4444-8444-444444444444") => ({
  id,
  entity: id,
  kind: "transaction",
  parents: [],
  actor: a,
  actorName: "Ali",
  at: "2026-01-01T00:00:00Z",
  data: { type: "income", amount: 12345, date: "2026-01-01" },
});
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role service_role bypassrls;create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  );
  await db.exec(
    `insert into auth.users values ('${a}'),('${b}'),('${outsider}');insert into public.workspaces(id,name) values ('${w}','Atölye');insert into public.members values ('${w}','${a}','Ali'),('${w}','${b}','Veli');`,
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function as(user) {
  await db.exec(
    `reset role;set role authenticated;set request.jwt.claim.sub='${user}';`,
  );
}
async function send(events) {
  return db.query("select public.append_events($1,$2::jsonb)", [
    w,
    JSON.stringify(events),
  ]);
}
it("gerçek PostgreSQL RPC tekrarlanan paketi yalnızca bir kere ekler", async () => {
  await as(a);
  await send([event()]);
  await send([event()]);
  expect((await db.query("select * from public.events")).rows).toHaveLength(1);
});
it("iki ortak aynı kayıtları okur, üçüncü kullanıcı okuyamaz veya yazamaz", async () => {
  await as(b);
  expect((await db.query("select * from public.events")).rows).toHaveLength(1);
  await as(outsider);
  expect((await db.query("select * from public.events")).rows).toHaveLength(0);
  await expect(send([event()])).rejects.toThrow("Access denied");
});
it("doğrudan ekleme, değiştirme ve silme engellenir", async () => {
  await as(a);
  await expect(db.query("delete from public.events")).rejects.toThrow();
  await expect(
    db.query("update public.events set payload='{}'"),
  ).rejects.toThrow();
  await expect(
    db.query(
      "insert into public.events(id,workspace_id,actor,payload) values ($1,$2,$3,'{}')",
      [crypto.randomUUID(), w, a],
    ),
  ).rejects.toThrow();
});
it("sahte ortak, negatif para, kimlik çarpışması ve eksik üst işlem reddedilir", async () => {
  await as(a);
  await expect(
    send([{ ...event(crypto.randomUUID()), actor: b }]),
  ).rejects.toThrow("Actor mismatch");
  await expect(
    send([
      {
        ...event(crypto.randomUUID()),
        data: { type: "income", amount: -1, date: "2026-01-01" },
      },
    ]),
  ).rejects.toThrow("Invalid cash movement");
  await expect(
    send([
      { ...event(), data: { type: "income", amount: 2, date: "2026-01-01" } },
    ]),
  ).rejects.toThrow("ID collision");
  await expect(
    send([{ ...event(crypto.randomUUID()), parents: [crypto.randomUUID()] }]),
  ).rejects.toThrow("Invalid event ancestry");
});
it("yeni çevrimdışı zincir sırası karışık gelse de kabul edilir ve döngü reddedilir", async () => {
  await as(a);
  const parent = event(crypto.randomUUID()),
    child = {
      ...event(crypto.randomUUID()),
      entity: parent.entity,
      parents: [parent.id],
    };
  await send([child, parent]);
  const x = event(crypto.randomUUID()),
    y = { ...event(crypto.randomUUID()), entity: x.entity, parents: [x.id] };
  x.parents = [y.id];
  await expect(send([x, y])).rejects.toThrow("Cyclic event ancestry");
});

it("iki bağımsız IndexedDB cihazı PostgreSQL üzerinden kayıpsız eşitlenir", async () => {
  const { openDB, append } = await import("../src/storage");
  const { sync } = await import("../src/cloud");
  const { materialize, totals } = await import("../src/domain");
  const one = openDB(crypto.randomUUID()),
    two = openDB(crypto.randomUUID());
  function client(user) {
    return {
      rpc: async (_name, args) => {
        try {
          await as(user);
          if (_name === "read_ledger") {
            const result = await db.query(
              "select public.read_ledger($1) as events",
              [w],
            );
            return { data: result.rows[0].events, error: null };
          }
          await send(args.p_events);
          return { error: null };
        } catch (error) {
          return { error };
        }
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              range: async (start, end) => {
                await as(user);
                const result = await db.query(
                  "select payload from public.events where workspace_id=$1 order by id limit $2 offset $3",
                  [w, end - start + 1, start],
                );
                return { data: result.rows, error: null };
              },
            }),
          }),
        }),
      }),
    };
  }
  const first = event(crypto.randomUUID());
  await append(one, first);
  await sync(one, w, client(a));
  await sync(two, w, client(b));
  const versionOne = {
    ...first,
    id: crypto.randomUUID(),
    parents: [first.id],
    data: { ...first.data, amount: 20000 },
  };
  const versionTwo = {
    ...first,
    id: crypto.randomUUID(),
    actor: b,
    actorName: "Veli",
    parents: [first.id],
    data: { ...first.data, amount: 30000 },
  };
  await append(one, versionOne);
  await append(two, versionTwo);
  await sync(one, w, client(a));
  await sync(two, w, client(b));
  await sync(one, w, client(a));
  expect(materialize(await one.events.toArray()).conflicts).toHaveLength(1);
  const resolve = {
    ...first,
    id: crypto.randomUUID(),
    parents: [versionOne.id, versionTwo.id],
    data: { ...first.data, amount: 30000 },
  };
  await append(one, resolve);
  await sync(one, w, client(a));
  await sync(two, w, client(b));
  await sync(two, w, client(b));
  const x = await one.events.toArray(),
    y = await two.events.toArray();
  expect(x).toEqual(y);
  expect(totals(materialize(x))).toEqual(totals(materialize(y)));
  expect(materialize(x).conflicts).toHaveLength(0);
  await one.delete();
  await two.delete();
});
