import React, { useRef, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Field } from "./ui.jsx";
import { changeAccountPassword } from "./account.js";
export default function ChangePassword({ client, close, done }) {
  const ref = useRef(null),
    lock = useRef(false);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    const el = ref.current;
    el.querySelector("input").focus();
    const key = (e) => {
      if (e.key === "Escape" && !lock.current) close();
      if (e.key === "Tab") {
        const all = [...el.querySelectorAll("input,button")].filter(
            (e) => !e.disabled,
          ),
          first = all[0],
          last = all.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    el.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  async function submit(e) {
    e.preventDefault();
    if (lock.current) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (!navigator.onLine)
        throw Error("Şifre değiştirmek için internet bağlantısı gerekli.");
      await changeAccountPassword(
        client,
        data.get("password"),
        data.get("confirmation"),
      );
      form.reset();
      done();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-title"
      >
        <div className="panel-heading">
          <h2 id="password-title">Şifremi değiştir</h2>
          <button
            className="icon-button"
            aria-label="Kapat"
            onClick={close}
            disabled={busy}
          >
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <Field
            label="Yeni şifre"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <Field
            label="Yeni şifreyi tekrar gir"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <p>
            En az 12 karakter kullanın. Bu işlem yalnızca kendi hesabınızın
            şifresini değiştirir.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="secondary"
              onClick={close}
              disabled={busy}
            >
              Vazgeç
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Kaydediliyor…" : "Şifreyi değiştir"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
