import { createClient } from "@supabase/supabase-js";
import { importEvents } from "./storage";
// Public project configuration; server secrets must never be placed here.
const projectUrl = import.meta.env.VITE_SUPABASE_URL || "https://ojemwqkycabuodmhbsui.supabase.co";
const projectKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ZHh08D4VHKj-dchLE12wbw_XPC55Gfp";
export const cloud =
  import.meta.env.VITE_LOCAL_ONLY === "true"
    ? null
    : createClient(projectUrl, projectKey);
export async function sync(db, workspace, client = cloud) {
  const events = await db.events.toArray();
  const sent = new Set((await db.sent.toArray()).map((r) => r.id));
  const pending = events.filter((e) => !sent.has(e.id));
  if (pending.length) {
    const { error } = await client.rpc("append_events", {
      p_workspace: workspace,
      p_events: pending,
    });
    if (error) throw error;
    await db.sent.bulkPut(pending.map((e) => ({ id: e.id })));
  }
  const { data: received, error: readError } = await client.rpc("read_ledger", {
    p_workspace: workspace,
  });
  if (readError) throw readError;
  await importEvents(db, received);
  await db.sent.bulkPut(received.map((e) => ({ id: e.id })));
  return { pending: 0, received: received.length };
}
export async function uploadBackup(workspace, file) {
  const { error } = await cloud
    .from("backups")
    .insert({ workspace_id: workspace, payload: file });
  if (error) throw error;
}
