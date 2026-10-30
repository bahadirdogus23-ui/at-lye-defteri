import "fake-indexeddb/auto";
import { it, expect, vi } from "vitest";
import { openDB, append } from "../src/storage";
import { sync } from "../src/cloud";
const event = {id:"a",entity:"a",kind:"stock",parents:[],actor:"a",actorName:"Ali",at:"2026-01-01T12:00:00Z",data:{name:"MDF",unit:"Adet",quantity:25,active:true}};
it("başarısız gönderimde çevrimdışı kayıt ve kuyruk korunur", async () => {
 const db=openDB(crypto.randomUUID()); await append(db,event);
 const client={rpc:vi.fn().mockResolvedValue({error:new Error("Bağlantı kesildi")})};
 await expect(sync(db,"workspace",client)).rejects.toThrow("Bağlantı kesildi");
 expect(await db.events.count()).toBe(1); expect(await db.sent.count()).toBe(0); await db.delete();
});
it("tekrar eşitleme kaydı çoğaltmaz ve gönderilmiş kaydı yeniden göndermez", async () => {
 const db=openDB(crypto.randomUUID()); await append(db,event);
 const client={rpc:vi.fn(async(name)=>name==="read_ledger"?{data:[event],error:null}:{error:null})};
 await sync(db,"workspace",client); await sync(db,"workspace",client);
 expect(await db.events.count()).toBe(1); expect(await db.sent.count()).toBe(1);
 expect(client.rpc.mock.calls.filter(([name])=>name==="append_events")).toHaveLength(1); await db.delete();
});
