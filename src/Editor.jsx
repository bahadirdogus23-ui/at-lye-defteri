import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cents, schedule, today, money } from "./domain.js";
import { Field } from "./ui.jsx";
const types = {
  income: "Gelir",
  expense: "Gider",
  opening: "Açılış bakiyesi",
  capital: "Ortak sermayesi",
  withdrawal: "Ortak çekişi",
};
export default function Editor({
  modal,
  close,
  save,
  attempt,
  categoryList,
  actor,
  error,
  setError,
}) {
  const { kind, record } = modal,
    d = record || {};
  const oldPayment = d.payments?.find((p) => p.id === modal.paymentId);
  const dialogRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    const controls = () =>
      [...dialog.querySelectorAll("button,input,select,textarea")].filter(
        (e) => !e.disabled && e.offsetParent !== null,
      );
    controls()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === "Tab") {
        const list = controls(),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    dialog.addEventListener("keydown", key);
    return () => {
      dialog.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  const submitLock = useRef(false);
  useEffect(() => {
    setError("");
  }, []);
  const [type, setType] = useState(d.type || "income"),
    [active, setActive] = useState(d.active !== false),
    [preview, setPreview] = useState("");
  const title = {
    transaction: "Para hareketi",
    job: "Taksitli iş",
    payment: "Tahsilat ekle",
    stock: "Malzeme",
    staff: "Personel",
    category: "Gider kategorisi",
    "stock-adjust": "Stok miktarını değiştir",
  }[kind];
  const submit = async (e) => {
    e.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    try {
      await attempt(async () => {
        const f = Object.fromEntries(new FormData(e.currentTarget));
        let data;
        if (kind === "transaction") {
          data = {
            type,
            amount: cents(f.amount),
            date: f.date,
            category: f.category,
            party: f.party,
            note: f.note,
            method: f.method,
          };
          if (!data.amount) throw Error("Tutar sıfırdan büyük olmalı.");
        }
        if (kind === "job") {
          const total = cents(f.total),
            deposit = cents(f.deposit),
            count = Number(f.count);
          const payments =
            d.payments ||
            (deposit
              ? [
                  {
                    id: crypto.randomUUID(),
                    amount: deposit,
                    date: f.depositDate,
                    method: f.method,
                    actor,
                  },
                ]
              : []);
          if (record && deposit !== d.deposit)
            throw Error(
              "Mevcut işin peşinatı değiştirilemez. Tahsilat geçmişini korumak için ek tahsilat girin.",
            );
          data = {
            customer: f.customer,
            description: f.description,
            total,
            deposit,
            schedule: schedule(total, deposit, count, f.first),
            payments,
            depositPaymentId:
              d.depositPaymentId || (deposit ? payments[0]?.id : null),
          };
        }
        if (kind === "payment") {
          const amount = cents(f.amount);
          if (
            amount <= 0 ||
            amount >
              d.total -
                d.payments.reduce((a, p) => a + p.amount, 0) +
                (oldPayment?.amount || 0)
          )
            throw Error(
              "Tahsilat sıfırdan büyük olmalı ve kalan borcu aşmamalı.",
            );
          const payment = {
            id: oldPayment?.id || crypto.randomUUID(),
            amount,
            date: f.date,
            method: f.method,
            actor,
          };
          data = {
            ...d,
            payments: oldPayment
              ? d.payments.map((p) => (p.id === oldPayment.id ? payment : p))
              : [...d.payments, payment],
          };
          if (oldPayment && d.depositPaymentId === oldPayment.id) {
            data.deposit = amount;
            const old = d.schedule;
            data.schedule = schedule(d.total, amount, old.length, old[0].date);
          }
        }
        if (kind === "stock")
          data = {
            name: f.name,
            unit: f.unit,
            quantity: Number(f.quantity),
            active,
          };
        if (kind === "stock-adjust") {
          const delta = Number(f.delta);
          if (!Number.isFinite(delta) || delta === 0)
            throw Error("Geçerli bir miktar değişikliği girin.");
          data = {
            ...d,
            quantity: Math.round((d.quantity + delta) * 1000) / 1000,
            lastReason: f.reason,
          };
        }
        if (kind === "staff") {
          if (!active && !f.end) throw Error("İşten ayrılma tarihi gerekli.");
          if (f.end && f.end < f.start)
            throw Error("Ayrılış tarihi girişten önce olamaz.");
          data = {
            name: f.name,
            role: f.role,
            phone: f.phone,
            start: f.start,
            end: active ? "" : f.end,
            active,
          };
        }
        if (kind === "category")
          data = {
            name: f.name,
            active: true,
            ...(d.original ? { original: d.original } : {}),
          };
        for (const k of ["id", "eventId", "actor", "updatedAt"]) delete data[k];
        await save(
          kind === "payment" ? "job" : kind === "stock-adjust" ? "stock" : kind,
          data,
          record,
        );
      })();
    } finally {
      submitLock.current = false;
    }
  };
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="modal"
      >
        <div className="panel-heading">
          <h2 id="dialog-title">
            {record && kind !== "payment" ? "Düzenle · " : ""}
            {title}
          </h2>
          <button className="icon-button" aria-label="Kapat" onClick={close}>
            <X />
          </button>
        </div>
        <form
          onSubmit={submit}
          onChange={(e) => {
            if (kind !== "job") return;
            const f = Object.fromEntries(new FormData(e.currentTarget));
            try {
              const s = schedule(
                cents(f.total),
                cents(f.deposit),
                Number(f.count),
                f.first,
              );
              setPreview(
                s.map((i) => `${i.date}: ${money(i.amount)}`).join(" · "),
              );
            } catch {
              setPreview("");
            }
          }}
        >
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
          {kind === "transaction" && (
            <>
              <Field label="İşlem türü">
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {Object.entries(types).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="form-grid">
                <Field
                  label="Tutar (₺)"
                  name="amount"
                  inputMode="decimal"
                  required
                  defaultValue={d.amount ? d.amount / 100 : ""}
                  placeholder="0,00"
                />
                <Field
                  label="Tarih"
                  name="date"
                  type="date"
                  defaultValue={d.date || today()}
                  required
                />
              </div>
              <Field label="Kategori / gelir türü">
                <select
                  name="category"
                  defaultValue={
                    d.category ||
                    (type === "income" ? "Diğer" : categoryList[0])
                  }
                >
                  {categoryList.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Kimden / kime (isteğe bağlı)"
                name="party"
                defaultValue={d.party}
              />
              <PaymentMethod value={d.method} />
              <Field label="Açıklama" name="note" defaultValue={d.note} />
            </>
          )}
          {kind === "job" && (
            <>
              <Field
                label="Müşteri adı"
                name="customer"
                defaultValue={d.customer}
                required
              />
              <Field
                label="İşin açıklaması"
                name="description"
                defaultValue={d.description}
                required
              />
              <div className="form-grid">
                <Field
                  label="Toplam satış (₺)"
                  name="total"
                  inputMode="decimal"
                  defaultValue={d.total ? d.total / 100 : ""}
                  required
                />
                <Field
                  label="Peşinat (₺)"
                  name="deposit"
                  inputMode="decimal"
                  defaultValue={d.deposit ? d.deposit / 100 : "0"}
                  readOnly={!!record}
                  required
                />
              </div>
              {!record && (
                <>
                  <Field
                    label="Peşinat tarihi"
                    name="depositDate"
                    type="date"
                    defaultValue={oldPayment?.date || today()}
                    required
                  />
                  <PaymentMethod value={oldPayment?.method} />
                </>
              )}
              <div className="form-grid">
                <Field
                  label="Taksit sayısı"
                  name="count"
                  type="number"
                  min="1"
                  max="120"
                  defaultValue={d.schedule?.length || 3}
                  required
                />
                <Field
                  label="İlk taksit tarihi"
                  name="first"
                  type="date"
                  defaultValue={d.schedule?.[0]?.date || today()}
                  required
                />
              </div>
              <div className="info">
                Sipariş toplamı kasaya eklenmez. Yalnızca peşinat ve sonraki
                tahsilatlar gelir olur.
              </div>
              {preview && <p className="schedule-preview">{preview}</p>}
            </>
          )}
          {kind === "payment" && (
            <>
              <div className="info">
                {d.customer} · Kalan:{" "}
                {money(d.total - d.payments.reduce((a, p) => a + p.amount, 0))}
              </div>
              <Field
                label="Tahsil edilen tutar (₺)"
                name="amount"
                inputMode="decimal"
                defaultValue={oldPayment ? oldPayment.amount / 100 : undefined}
                required
              />
              <Field
                label="Ödeme tarihi"
                name="date"
                type="date"
                defaultValue={oldPayment?.date || today()}
                required
              />
              <PaymentMethod value={oldPayment?.method} />
            </>
          )}
          {kind === "stock" && (
            <>
              <Field
                label="Malzeme adı"
                name="name"
                defaultValue={d.name}
                required
              />
              <div className="form-grid">
                <Field label="Birim">
                  <select name="unit" defaultValue={d.unit || "Adet"}>
                    <option>Adet</option>
                    <option>Metre</option>
                  </select>
                </Field>
                <Field
                  label="Miktar"
                  name="quantity"
                  type="number"
                  min="0"
                  step="0.001"
                  defaultValue={d.quantity || 0}
                  required
                />
              </div>
              <Field label="Durum">
                <select
                  value={String(active)}
                  onChange={(e) => setActive(e.target.value === "true")}
                >
                  <option value="true">Aktif</option>
                  <option value="false">Pasif</option>
                </select>
              </Field>
            </>
          )}
          {kind === "stock-adjust" && (
            <>
              <div className="info">
                {d.name} · Mevcut: {d.quantity} {d.unit}
              </div>
              <Field
                label="Değişim (+ artırma / − azaltma)"
                name="delta"
                type="number"
                step="0.001"
                required
              />
              <Field label="İşlem açıklaması" name="reason" required />
            </>
          )}
          {kind === "staff" && (
            <>
              <Field
                label="Ad soyad"
                name="name"
                defaultValue={d.name}
                required
              />
              <Field label="Görev" name="role" defaultValue={d.role} required />
              <Field
                label="Telefon (isteğe bağlı)"
                name="phone"
                type="tel"
                defaultValue={d.phone}
              />
              <Field
                label="İşe giriş tarihi"
                name="start"
                type="date"
                defaultValue={d.start || today()}
                required
              />
              <Field label="Durum">
                <select
                  value={String(active)}
                  onChange={(e) => setActive(e.target.value === "true")}
                >
                  <option value="true">Aktif</option>
                  <option value="false">İşten ayrıldı</option>
                </select>
              </Field>
              {!active && (
                <Field
                  label="İşten ayrılma tarihi"
                  name="end"
                  type="date"
                  defaultValue={d.end || today()}
                  required
                />
              )}
            </>
          )}
          {kind === "category" && (
            <Field
              label="Kategori adı"
              name="name"
              defaultValue={d.name}
              required
            />
          )}
          <div className="modal-actions">
            {oldPayment && (
              <button
                type="button"
                className="danger"
                onClick={attempt(async () => {
                  const next = {
                    ...d,
                    payments: d.payments.filter((p) => p.id !== oldPayment.id),
                  };
                  if (d.depositPaymentId === oldPayment.id) {
                    next.deposit = 0;
                    next.depositPaymentId = null;
                    next.schedule = schedule(
                      d.total,
                      0,
                      d.schedule.length,
                      d.schedule[0].date,
                    );
                  }
                  for (const key of ["id", "eventId", "actor", "updatedAt"])
                    delete next[key];
                  await save("job", next, d);
                })}
              >
                Tahsilatı iptal et
              </button>
            )}

            {record && kind === "transaction" && (
              <button
                type="button"
                className="danger"
                onClick={attempt(() =>
                  save("transaction", { ...d, cancelled: true }, d),
                )}
              >
                İşlemi iptal et
              </button>
            )}
            <button type="button" className="secondary" onClick={close}>
              Vazgeç
            </button>
            <button className="primary" type="submit">
              Kaydet
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function PaymentMethod({ value }) {
  return (
    <Field label="Ödeme yöntemi">
      <select name="method" defaultValue={value || "Nakit"}>
        <option>Nakit</option>
        <option>Havale / EFT</option>
        <option>Kart</option>
      </select>
    </Field>
  );
}
