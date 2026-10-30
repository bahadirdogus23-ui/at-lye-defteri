// Server-only handler; never imported by the browser bundle.
import { encryptBackup } from "./backup.js";
export function backupHandler(getEnv, requestFetch = fetch) {
  return async (request) => {
    const trigger = getEnv("ATOLYE_BACKUP_TRIGGER_KEY"),
      password = getEnv("ATOLYE_BACKUP_PASSPHRASE"),
      url = getEnv("SUPABASE_URL"),
      key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!trigger || !password || password.length < 12 || !url || !key)
      return new Response("Backup configuration missing", { status: 503 });
    const supplied = request.headers.get("x-backup-key") || "";
    let diff = trigger.length ^ supplied.length;
    for (let i = 0; i < trigger.length; i++)
      diff |= trigger.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
    if (request.method !== "POST" || diff)
      return new Response("Unauthorized", { status: 401 });
    const headers = {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    };
    async function api(path, body) {
      const response = await requestFetch(url + "/rest/v1/" + path, {
        method: body ? "POST" : "GET",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok)
        throw Error("Backup service failed: HTTP " + response.status);
      return response.status === 201 || response.status === 204
        ? null
        : response.json();
    }
    try {
      const workspaces = await api("workspaces?select=id");
      let count = 0;
      for (const workspace of workspaces) {
        const events = await api("rpc/read_ledger", {
          p_workspace: workspace.id,
        });
        const payload = await encryptBackup(events, password, workspace.id);
        await api("backups", { workspace_id: workspace.id, payload });
        count++;
      }
      return Response.json({ backedUp: count });
    } catch {
      return new Response(
        "Backup failed; inspect server status without exposing credentials.",
        { status: 500 },
      );
    }
  };
}
