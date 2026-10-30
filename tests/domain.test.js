import { describe, it, expect } from "vitest";
import {
  cents,
  schedule,
  materialize,
  totals,
  mergeEvents,
  validateEvent,
} from "../src/domain";
const event = (id, data = {}, parents = [], kind = "transaction") => ({
  id,
  entity: "record",
  kind,
  parents,
  actor: "partner-a",
  actorName: "Ali",
  at: "2026-01-01T12:00:00Z",
  data: { type: "income", amount: 100, date: "2026-01-01", ...data },
});
describe("para ve taksit hesapları", () => {
  it("kuruş hassasiyetinde ayrıştırır, fazla ondalığı ve negatif değeri reddeder", () => {
    expect(cents("123,45")).toBe(12345);
    expect(cents("0.10") + cents("0.20")).toBe(30);
    for (const input of ["1.001", "-1", "1e6", "", "NaN"])
      expect(() => cents(input)).toThrow();
  });
  it("kalan kuruşları kaybetmeden taksitlere dağıtır", () => {
    const s = schedule(10000, 0, 3, "2026-01-31");
    expect(s.map((x) => x.amount)).toEqual([3334, 3333, 3333]);
    expect(s.map((x) => x.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });
  it("sipariş tutarını kasaya yazmaz, yalnızca tahsilatı sayar", () => {
    const j = event(
      "j",
      {
        customer: "Ayşe",
        total: 100000,
        deposit: 20000,
        schedule: schedule(100000, 20000, 2, "2026-01-01"),
        payments: [{ id: "p", amount: 20000, date: "2026-01-01", actor: "a" }],
      },
      [],
      "job",
    );
    const s = materialize([j]);
    expect(totals(s, "2026-01").balance).toBe(20000);
    expect(totals(s, "2026-01").receivable).toBe(80000);
  });
  it("sermaye ve kişisel çekişleri aylık gelir giderden ayırır", () => {
    const a = event("a", { type: "capital", amount: 10000 });
    const b = {
      ...event("b", { type: "withdrawal", amount: 2000 }),
      entity: "b",
    };
    const t = totals(materialize([a, b]), "2026-01");
    expect(t.balance).toBe(8000);
    expect(t.income).toBe(0);
    expect(t.expense).toBe(0);
  });
});
describe("değiştirilemez günlük ve birleştirme", () => {
  it("aynı paketi iki kere işlemek mükerrer kayıt oluşturmaz", () => {
    const a = event("a");
    const merged = mergeEvents([a], [a, a]);
    expect(merged).toHaveLength(1);
    expect(totals(materialize(merged)).balance).toBe(100);
  });
  it("düzeltme ve iptalde eski kayıtları korur", () => {
    const a = event("a"),
      b = event("b", { amount: 200 }, ["a"]),
      c = event("c", { amount: 200, cancelled: true }, ["b"]);
    expect(totals(materialize([a, b])).balance).toBe(200);
    expect(materialize([a, b, c]).transaction).toHaveLength(0);
    expect(mergeEvents([a, b], [c])).toHaveLength(3);
  });
  it("iki cihazın çakışmasını sessizce ezmez, açık çözüm ister", () => {
    const a = event("a"),
      b = event("b", { amount: 200 }, ["a"]),
      c = event("c", { amount: 300 }, ["a"]);
    const s = materialize(mergeEvents([a, b], [c]));
    expect(s.conflicts).toHaveLength(1);
    expect(s.transaction).toHaveLength(0);
    const resolved = event("d", { amount: 300 }, ["b", "c"]);
    expect(
      totals(materialize(mergeEvents([a, b, c], [resolved]))).balance,
    ).toBe(300);
  });
  it("iki cihazdaki kayıtlar iki yönde birleştirilince eşit olur", () => {
    const a = event("a");
    const b = {
      ...event("b", { type: "expense", amount: 30 }),
      entity: "expense",
    };
    const x = mergeEvents([a], [b]),
      y = mergeEvents([b], [a]);
    expect(totals(materialize(x))).toEqual(totals(materialize(y)));
    expect(x).toHaveLength(y.length);
  });
  it("kimlik çarpışması, eksik ve döngüsel zinciri reddeder", () => {
    expect(() =>
      mergeEvents([event("a")], [event("a", { amount: 2 })]),
    ).toThrow();
    expect(() => mergeEvents([], [event("b", {}, ["a"])])).toThrow();
    expect(() =>
      mergeEvents([], [event("a", {}, ["b"]), event("b", {}, ["a"])]),
    ).toThrow();
  });
  it("negatif stok ve fazla tahsilatı reddeder", () => {
    expect(() =>
      validateEvent(
        event("s", { name: "MDF", unit: "Adet", quantity: -1 }, [], "stock"),
      ),
    ).toThrow();
    expect(() =>
      validateEvent(
        event(
          "j",
          {
            total: 100,
            deposit: 0,
            schedule: [{ amount: 100, date: "2026-01-01" }],
            payments: [
              { id: "p", amount: 200, date: "2026-01-01", actor: "a" },
            ],
          },
          [],
          "job",
        ),
      ),
    ).toThrow();
  });
});
