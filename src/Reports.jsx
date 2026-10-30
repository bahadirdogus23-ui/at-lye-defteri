import React, { useState } from "react";
import { money, today } from "./domain.js";
import { Field } from "./ui.jsx";
const types = {
  income: "Gelir",
  expense: "Gider",
  opening: "Açılış bakiyesi",
  capital: "Ortak sermayesi",
  withdrawal: "Ortak çekişi",
};
export default function Reports({
  state,
  events,
  rows,
  exportTable,
  attempt,
  actors,
}) {
  const [period, setPeriod] = useState("month"),
    [date, setDate] = useState(today());
  const selected = rows.filter((r) =>
    r.date.startsWith(
      period === "day"
        ? date
        : period === "month"
          ? date.slice(0, 7)
          : date.slice(0, 4),
    ),
  );
  const grouped = {};
  for (const r of selected.filter((r) => r.type === "expense"))
    grouped[r.category] = (grouped[r.category] || 0) + r.amount;
  const income = selected
      .filter((r) => r.type === "income")
      .reduce((a, r) => a + r.amount, 0),
    expense = selected
      .filter((r) => r.type === "expense")
      .reduce((a, r) => a + r.amount, 0);
  const reports = {
    "Gelir-gider": selected.map((r) => ({
      Tarih: r.date,
      Tür: types[r.type],
      Kategori: r.category || "",
      "Tutar TL": r.amount / 100,
      Ortak: actors.find((a) => a[0] === r.actor)?.[1] || r.actor,
    })),
    "Kategoriye göre giderler": Object.entries(grouped).map(([k, v]) => ({
      Kategori: k,
      "Tutar TL": v / 100,
    })),
    "Müşteri alacakları": state.job.map((j) => ({
      Müşteri: j.customer,
      İş: j.description,
      "Kalan TL":
        (j.total - j.payments.reduce((a, p) => a + p.amount, 0)) / 100,
    })),
    "Stok listesi": state.stock.map((s) => ({
      Malzeme: s.name,
      Birim: s.unit,
      Miktar: s.quantity,
      Durum: s.active ? "Aktif" : "Pasif",
    })),
    "Personel listesi": state.staff.map((s) => ({
      "Ad soyad": s.name,
      Görev: s.role,
      Telefon: s.phone,
      Giriş: s.start,
      Ayrılış: s.end,
      Durum: s.active ? "Aktif" : "Pasif",
    })),
    "Ortak kayıt geçmişi": [...events]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((e) => ({
        Ortak: e.actorName,
        Tarih: e.at,
        Modül: e.kind,
        İşlem: e.data.cancelled
          ? "İptal"
          : e.parents.length
            ? "Düzenleme"
            : "Ekleme",
        "Kayıt kimliği": e.entity,
        "İşlem kimliği": e.id,
      })),
  };
  return (
    <>
      <section className="panel padded">
        <div className="filters">
          <Field label="Dönem">
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="day">Günlük</option>
              <option value="month">Aylık</option>
              <option value="year">Yıllık</option>
            </select>
          </Field>
          <Field
            label="Tarih"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="job-amounts">
          <div>
            Gelir<strong>{money(income)}</strong>
          </div>
          <div>
            Gider<strong>{money(expense)}</strong>
          </div>
          <div>
            Fark<strong>{money(income - expense)}</strong>
          </div>
        </div>
      </section>
      <div className="report-grid">
        {Object.entries(reports).map(([name, data]) => (
          <section className="panel padded" key={name}>
            <h2>{name}</h2>
            <p>{data.length} kayıt</p>
            <div className="actions">
              <button
                className="secondary"
                onClick={attempt(() => exportTable("csv", data, name))}
              >
                CSV indir
              </button>
              <button
                className="secondary"
                onClick={attempt(() => exportTable("xlsx", data, name))}
              >
                Excel indir
              </button>
            </div>
            <div className="report-preview">
              {data.slice(0, 20).map((r, i) => (
                <div key={i}>{Object.values(r).join(" · ")}</div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
