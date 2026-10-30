import React, { useState, useEffect, useRef, useCallback } from "react";
import { FolderOpen } from "lucide-react";
import { writeFolderBackup } from "./folder-backup.js";
export default function FolderBackup({ db, scope, password, events }) {
  const supported = typeof window.showDirectoryPicker === "function";
  const [handle, setHandle] = useState(null),
    [enabled, setEnabled] = useState(false),
    [last, setLast] = useState(null),
    [status, setStatus] = useState(""),
    [tick, setTick] = useState(0);
  const busy = useRef(false),
    signature = useRef(null);
  useEffect(() => {
    if (!db) return;
    let active = true;
    db.settings
      .get("folder-backup")
      .then((saved) => {
        if (!active || !saved) return;
        setHandle(saved.handle);
        setEnabled(saved.enabled);
        setLast(saved.lastAt || null);
        signature.current = null;
      })
      .catch(() => {
        if (active) setStatus("Klasör ayarı okunamadı. Yeniden klasör seçin.");
      });
    return () => {
      active = false;
    };
  }, [db]);
  useEffect(() => {
    signature.current = null;
  }, [password]);
  const run = useCallback(async () => {
    if (!db || !handle || !enabled || password.length < 12 || busy.current)
      return;
    busy.current = true;
    try {
      const result = await writeFolderBackup(
        handle,
        await db.events.toArray(),
        password,
        scope,
        signature.current,
      );
      if (!result.unchanged) {
        signature.current = result.signature;
        await db.settings.update("folder-backup", {
          lastAt: result.at,
          signature: result.signature,
        });
        setLast(result.at);
        setStatus("Şifreli yedek klasöre kaydedildi.");
      } else setStatus("Klasördeki yedek güncel.");
    } catch (e) {
      setStatus("Klasör yedeği alınamadı: " + e.message);
    } finally {
      busy.current = false;
    }
  }, [db, handle, enabled, password, scope]);
  useEffect(() => {
    const timer = setTimeout(run, 2000);
    return () => clearTimeout(timer);
  }, [run, events, tick]);
  useEffect(() => {
    const timer = setInterval(run, 300000);
    const visible = () => {
      if (!document.hidden) run();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [run]);
  async function choose() {
    try {
      if (password.length < 12)
        throw Error("Önce en az 12 karakterlik yedek parolanızı girin.");
      const selected = await window.showDirectoryPicker({
        mode: "readwrite",
        id: "atolye-backups",
      });
      await db.settings.put({
        id: "folder-backup",
        handle: selected,
        enabled: true,
      });
      signature.current = null;
      setHandle(selected);
      setEnabled(true);
      setLast(null);
      setStatus("Klasör seçildi. İlk şifreli yedek hazırlanıyor.");
      setTick((t) => t + 1);
    } catch (e) {
      if (e.name !== "AbortError") setStatus(e.message);
    }
  }
  async function renew() {
    try {
      if ((await handle.requestPermission({ mode: "readwrite" })) !== "granted")
        throw Error("Klasöre yazma izni verilmedi.");
      await db.settings.update("folder-backup", { enabled: true });
      setEnabled(true);
      setTick((t) => t + 1);
      setStatus("Klasör izni alındı.");
    } catch (e) {
      setStatus(e.message);
    }
  }
  async function disable() {
    try {
      await db.settings.update("folder-backup", { enabled: false });
      setEnabled(false);
      setStatus("Otomatik klasör yedeği durduruldu. Önceki dosyalar korunur.");
    } catch (e) {
      setStatus(e.message);
    }
  }
  return (
    <section className="folder-backup">
      <h3>
        <FolderOpen size={18} /> Otomatik klasör yedeği
      </h3>
      {supported ? (
        <>
          <p>
            Bir klasör seçin. Her değişiklikten yaklaşık 2 saniye sonra şifreli
            tam yedek otomatik yazılır. Uygulama açıkken 5 dakikada bir de
            kontrol edilir. Önceki yedeklerin üzerine yazılmaz.
          </p>
          <div className="actions">
            <button className="secondary" onClick={choose}>
              {handle ? "Klasörü değiştir" : "Yedek klasörü seç"}
            </button>
            {handle && (
              <>
                <button className="secondary" onClick={renew}>
                  Klasör iznini yenile
                </button>
                {enabled && (
                  <button className="secondary" onClick={disable}>
                    Otomatik yedeği durdur
                  </button>
                )}
              </>
            )}
          </div>
          {handle && (
            <p>
              Klasör: <strong>{handle.name}</strong> ·{" "}
              {enabled ? "Etkin" : "Durduruldu"}
              <br />
              Son klasör yedeği:{" "}
              {last
                ? new Date(last).toLocaleString("tr-TR")
                : "Henüz yazılmadı"}
            </p>
          )}
          <p>
            Uygulama kapalıyken çalışmaz. Yeniden açtığınızda yedek parolanızı
            girin; tarayıcı isterse klasör iznini yenileyin. Parola saklanmaz.
          </p>
        </>
      ) : (
        <p>
          Bu tarayıcı otomatik klasöre yazmayı desteklemiyor. Bilgisayarda
          Chrome veya Edge kullanın; bu cihazda aşağıdaki “Tam JSON yedeği
          indir” düğmesini kullanabilirsiniz.
        </p>
      )}
      {status && (
        <div className="info" role="status">
          {status}
        </div>
      )}
    </section>
  );
}
