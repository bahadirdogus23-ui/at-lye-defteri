export const categories = [
  "MDF",
  "Hırdavat",
  "Yemek",
  "Kira",
  "Elektrik",
  "Nakliye",
  "Personel",
  "Diğer",
];
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const money = (n) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
    n / 100,
  );
export function cents(input) {
  const s = String(input).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw Error("Tutarı en fazla iki ondalık basamakla girin.");
  const [a, b = ""] = s.split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n > 1e13)
    throw Error("Tutar izin verilen sınırı aşıyor.");
  return n;
}
export function schedule(total, deposit, count, first) {
  if (
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(deposit) ||
    total <= 0 ||
    deposit < 0 ||
    deposit > total
  )
    throw Error("Satış ve peşinat tutarlarını kontrol edin.");
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 120 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(first)
  )
    throw Error("Taksit sayısı 1–120 arasında olmalı ve tarih seçilmelidir.");
  const [y, m, d] = first.split("-").map(Number);
  const rest = total - deposit;
  return Array.from({ length: count }, (_, i) => {
    const end = new Date(Date.UTC(y, m + i, 0)).getUTCDate();
    const date = new Date(Date.UTC(y, m - 1 + i, Math.min(d, end)))
      .toISOString()
      .slice(0, 10);
    return {
      date,
      amount: Math.floor(rest / count) + (i < rest % count ? 1 : 0),
    };
  });
}
export function materialize(events) {
  const groups = new Map();
  for (const e of events) {
    const key = `${e.kind}:${e.entity}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const records = {
      transaction: [],
      job: [],
      stock: [],
      staff: [],
      category: [],
    },
    conflicts = [];
  for (const list of groups.values()) {
    const parents = new Set(list.flatMap((e) => e.parents));
    const leaves = list.filter((e) => !parents.has(e.id));
    if (leaves.length !== 1) {
      conflicts.push({
        kind: list[0].kind,
        entity: list[0].entity,
        versions: leaves,
      });
      continue;
    }
    const e = leaves[0];
    if (!e.data.cancelled)
      records[e.kind].push({
        ...e.data,
        id: e.entity,
        eventId: e.id,
        actor: e.actor,
        updatedAt: e.at,
      });
  }
  return { ...records, conflicts };
}
export function cashRows(state) {
  return [
    ...state.transaction,
    ...state.job.flatMap((j) =>
      (j.payments || []).map((p) => ({
        ...p,
        id: p.id,
        type: "income",
        category: "İş tahsilatı",
        party: j.customer,
        note: j.description,
        jobId: j.id,
        actor: p.actor,
      })),
    ),
  ];
}
export function totals(state, month = today().slice(0, 7)) {
  const rows = cashRows(state);
  const sign = (r) =>
    ["income", "opening", "capital"].includes(r.type) ? 1 : -1;
  const monthly = rows.filter((r) => r.date.startsWith(month));
  const income = monthly
    .filter((r) => r.type === "income")
    .reduce((a, r) => a + r.amount, 0);
  const expense = monthly
    .filter((r) => r.type === "expense")
    .reduce((a, r) => a + r.amount, 0);
  let receivable = 0,
    overdue = 0;
  for (const j of state.job) {
    const paid = j.payments.reduce((a, p) => a + p.amount, 0);
    receivable += j.total - paid;
    let allocated = Math.max(0, paid - j.deposit);
    for (const s of j.schedule) {
      const remaining = Math.max(0, s.amount - allocated);
      allocated = Math.max(0, allocated - s.amount);
      if (s.date < today()) overdue += remaining;
    }
  }
  return {
    balance: rows.reduce((a, r) => a + sign(r) * r.amount, 0),
    income,
    expense,
    difference: income - expense,
    receivable,
    overdue,
  };
}
export function validateEvent(e) {
  if (
    !e ||
    typeof e.id !== "string" ||
    typeof e.entity !== "string" ||
    !["transaction", "job", "stock", "staff", "category"].includes(e.kind) ||
    !Array.isArray(e.parents) ||
    !e.parents.every((p) => typeof p === "string") ||
    typeof e.actor !== "string" ||
    typeof e.actorName !== "string" ||
    !e.data ||
    typeof e.data !== "object" ||
    Array.isArray(e.data) ||
    !Number.isFinite(Date.parse(e.at))
  )
    throw Error("Geçersiz işlem paketi.");
  const d = e.data;
  for (const key of ["cancelled", "active"])
    if (d[key] !== undefined && typeof d[key] !== "boolean")
      throw Error("Geçersiz kayıt durumu.");
  for (const key of [
    "name",
    "customer",
    "description",
    "category",
    "party",
    "note",
    "method",
    "role",
    "phone",
    "start",
    "end",
    "lastReason",
    "original",
  ])
    if (
      d[key] !== undefined &&
      (typeof d[key] !== "string" || d[key].length > 4000)
    )
      throw Error("Geçersiz metin alanı.");

  const amount = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1e13;
  const date = (x) =>
    typeof x === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(x) &&
    Number.isFinite(Date.parse(x)) &&
    new Date(x).toISOString().slice(0, 10) === x;
  if (
    e.kind === "transaction" &&
    (!amount(d.amount) ||
      d.amount === 0 ||
      !date(d.date) ||
      !["income", "expense", "opening", "capital", "withdrawal"].includes(
        d.type,
      ))
  )
    throw Error("Geçersiz para hareketi.");
  if (
    e.kind === "job" &&
    (!amount(d.total) ||
      d.total === 0 ||
      !amount(d.deposit) ||
      d.deposit > d.total ||
      !Array.isArray(d.schedule) ||
      !Array.isArray(d.payments) ||
      !d.schedule.every((s) => amount(s.amount) && date(s.date)) ||
      d.schedule.reduce((a, s) => a + s.amount, 0) !== d.total - d.deposit ||
      !d.payments.every(
        (p) =>
          amount(p.amount) &&
          p.amount > 0 &&
          date(p.date) &&
          typeof p.actor === "string" &&
          typeof p.id === "string",
      ) ||
      new Set(d.payments.map((p) => p.id)).size !== d.payments.length ||
      d.payments.reduce((a, p) => a + p.amount, 0) > d.total)
  )
    throw Error("Geçersiz taksitli iş.");
  if (
    e.kind === "stock" &&
    (!["Adet", "Metre"].includes(d.unit) ||
      !Number.isFinite(d.quantity) ||
      d.quantity < 0)
  )
    throw Error("Geçersiz stok.");
  if (
    ["stock", "staff", "category"].includes(e.kind) &&
    !String(d.name || "").trim()
  )
    throw Error("Ad zorunludur.");
  if (
    e.kind === "staff" &&
    (!date(d.start) || (d.end && !date(d.end)) || (d.end && d.end < d.start))
  )
    throw Error("Geçersiz personel tarihi.");
  return e;
}
export function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function mergeEvents(existing, incoming) {
  const map = new Map(existing.map((e) => [e.id, e]));
  for (const e of incoming) {
    validateEvent(e);
    if (map.has(e.id) && canonical(map.get(e.id)) !== canonical(e))
      throw Error(
        "Aynı işlem kimliğinde farklı içerik var. Veriler korunmuştur.",
      );
    map.set(e.id, e);
  }
  const all = [...map.values()];
  const byId = new Map(all.map((e) => [e.id, e]));
  for (const e of all)
    for (const p of e.parents) {
      const parent = byId.get(p);
      if (
        !parent ||
        parent.entity !== e.entity ||
        parent.kind !== e.kind ||
        p === e.id
      )
        throw Error("İşlem zinciri eksik veya hatalı.");
    }
  const visited = new Set(),
    active = new Set();
  function visit(e) {
    if (active.has(e.id)) throw Error("Döngüsel işlem zinciri.");
    if (visited.has(e.id)) return;
    active.add(e.id);
    e.parents.forEach((p) => visit(byId.get(p)));
    active.delete(e.id);
    visited.add(e.id);
  }
  all.forEach(visit);
  return all;
}
