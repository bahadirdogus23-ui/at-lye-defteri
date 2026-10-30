import FolderBackup from "./FolderBackup.jsx";
import Editor from "./Editor.jsx";
import Reports from "./Reports.jsx";
import { Field, Empty } from "./ui.jsx";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  ArrowLeftRight,
  CalendarDays,
  Package,
  Users,
  FileText,
  History,
  ShieldCheck,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  ChevronRight,
  Menu,
  RefreshCw,
  LogOut,
  Download,
  X,
  BookOpen,
  CloudOff,
} from "lucide-react";
import {
  categories,
  today,
  money,
  cents,
  schedule,
  materialize,
  cashRows,
  totals,
} from "./domain";
import { openDB, append, encryptBackup, restore } from "./storage";
import { cloud, sync, uploadBackup } from "./cloud";
import "./style.css";
const tabs = [
  ["Özet", LayoutDashboard],
  ["Gelir ve gider", ArrowLeftRight],
  ["Taksitli işler", CalendarDays],
  ["Stok", Package],
  ["Personel", Users],
  ["Raporlar", FileText],
  ["İşlem geçmişi", History],
  ["Yedekleme", ShieldCheck],
];
const types = {
  income: "Gelir",
  expense: "Gider",
  opening: "Açılış bakiyesi",
  capital: "Ortak sermayesi",
  withdrawal: "Ortak çekişi",
};
const download = (name, content, type = "application/json") => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function App() {
  const [identity, setIdentity] = useState(null),
    [session, setSession] = useState(null),
    [workspace, setWorkspace] = useState(""),
    [authReady, setAuthReady] = useState(!cloud),
    [events, setEvents] = useState([]),
    [tab, setTab] = useState("Özet"),
    [modal, setModal] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [syncStatus, setSyncStatus] = useState(""),
    [pending, setPending] = useState(0),
    [mobile, setMobile] = useState(false),
    [password, setPassword] = useState(""),
    [lastBackup, setLastBackup] = useState(null),
    [lastManual, setLastManual] = useState(null),
    [cloudBackups, setCloudBackups] = useState([]),
    [filter, setFilter] = useState({
      from: "",
      to: "",
      category: "",
      actor: "",
    });
  const dbRef = useRef(null),
    busy = useRef(false),
    backupBusy = useRef(false),
    passwordRef = useRef("");
  passwordRef.current = password;
  const scope = identity ? (identity.local ? "local" : workspace) : null;
  useEffect(() => {
    if (!cloud) return;
    cloud.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = cloud.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) return;
    let active = true;
    (async () => {
      const { data, error } = await cloud
        .from("members")
        .select("workspace_id,display_name")
        .eq("user_id", session.user.id);
      if (!active) return;
      if (error) {
        const cached = localStorage.getItem(
          "atolye-membership-" + session.user.id,
        );
        if (cached) {
          try {
            const member = JSON.parse(cached);
            setWorkspace(member.workspace_id);
            setIdentity({
              id: session.user.id,
              name: member.display_name,
              local: false,
            });
            setNotice(
              "Kayıtlı hesapla çevrimdışı çalışılıyor. Bağlantı geldiğinde üyelik tekrar kontrol edilir.",
            );
          } catch {
            setError("Kayıtlı hesap bilgisi okunamadı.");
          }
        } else setError(error.message);
        return;
      }
      if (data?.length !== 1) {
        setError(
          "Hesabınız tam bir işletmeye bağlanmalı. Kurulum yönergesindeki üyelik adımını tamamlayın.",
        );
        return;
      }
      localStorage.setItem(
        "atolye-membership-" + session.user.id,
        JSON.stringify(data[0]),
      );
      setWorkspace(data[0].workspace_id);
      setIdentity({
        id: session.user.id,
        name: data[0].display_name,
        local: false,
      });
    })();
    return () => {
      active = false;
    };
  }, [session, online]);
  const load = async () => {
    const db = dbRef.current;
    if (!db) return;
    setEvents(await db.events.toArray());
    const sent = await db.sent.count();
    setPending((await db.events.count()) - sent);
    const backups = await db.backups.orderBy("at").last();
    setLastBackup(backups?.at || null);
    const manual = (await db.backups.toArray())
      .filter((b) => b.reason === "manual")
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    setLastManual(manual?.at || null);
  };
  useEffect(() => {
    if (!scope) return;
    const db = openDB(scope);
    dbRef.current = db;
    load().catch((e) => setError(e.message));
    return () => {
      db.close();
      dbRef.current = null;
      setEvents([]);
    };
  }, [scope]);
  useEffect(() => {
    const handler = () => setOnline(navigator.onLine);
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
    };
  }, []);
  async function doSync() {
    if (!dbRef.current || identity?.local || !online || busy.current) return;
    busy.current = true;
    setSyncStatus("Eşitleniyor…");
    try {
      await sync(dbRef.current, workspace);
      await load();
      setSyncStatus("Tüm kayıtlar eşitlendi");
    } catch (e) {
      setSyncStatus("Eşitlenemedi: " + e.message);
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    if (!scope || identity?.local) return;
    doSync();
    const timer = setInterval(doSync, 15000);
    return () => clearInterval(timer);
  }, [scope, online]);
  useEffect(() => {
    if (!scope) return;
    const run = async () => {
      if (passwordRef.current.length < 12 || backupBusy.current) return;
      const db = dbRef.current;
      if (!db) return;
      const previous = await db.backups.orderBy("at").last();
      if (previous && Date.now() - Date.parse(previous.at) < 86400000) return;
      backupBusy.current = true;
      try {
        const file = await encryptBackup(
          await db.events.toArray(),
          passwordRef.current,
          scope,
        );
        const id = crypto.randomUUID();
        await db.backups.add({
          id,
          at: new Date().toISOString(),
          reason: "automatic",
          file,
          uploaded: false,
        });
        await load();
      } catch (e) {
        setError(e.message);
      } finally {
        backupBusy.current = false;
      }
    };
    run();
    const timer = setInterval(run, 60000);
    return () => clearInterval(timer);
  }, [scope, password]);
  useEffect(() => {
    if (!scope || identity?.local || !online) return;
    const run = async () => {
      try {
        const rows = await dbRef.current.backups.toArray();
        for (const b of rows.filter((b) => !b.uploaded)) {
          await uploadBackup(workspace, b.file);
          await dbRef.current.backups.update(b.id, { uploaded: true });
        }
      } catch (e) {
        setNotice("Bulut yedeği bekliyor: " + e.message);
      }
    };
    run();
    const timer = setInterval(run, 60000);
    return () => clearInterval(timer);
  }, [scope, online, lastBackup]);
  const state = materialize(events),
    summary = totals(state),
    rows = cashRows(state).sort((a, b) => b.date.localeCompare(a.date));
  const categoryRecords = [
    ...categories.map(
      (name, index) =>
        state.category.find((c) => c.original === name) || {
          id: "00000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
          name,
          original: name,
        },
    ),
    ...state.category.filter((c) => !c.original),
  ];
  const categoryList = [
    ...new Set(
      categoryRecords.filter((c) => c.active !== false).map((c) => c.name),
    ),
  ];
  async function save(kind, data, record = null, parents = null) {
    const e = {
      id: crypto.randomUUID(),
      entity: record?.id || crypto.randomUUID(),
      kind,
      parents: parents || (record?.eventId ? [record.eventId] : []),
      actor: identity.id,
      actorName: identity.name,
      at: new Date().toISOString(),
      data,
    };
    await append(dbRef.current, e);
    await load();
    setModal(null);
    setNotice("Kayıt cihazınıza kaydedildi.");
    doSync();
  }
  const attempt =
    (fn) =>
    async (...args) => {
      setError("");
      try {
        await fn(...args);
      } catch (e) {
        setError(e.message || "İşlem tamamlanamadı.");
      }
    };
  async function signIn(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await cloud.auth.signInWithPassword({
      email: f.get("email"),
      password: f.get("password"),
    });
    if (error) throw error;
  }
  const filtered = rows.filter(
    (r) =>
      (!filter.from || r.date >= filter.from) &&
      (!filter.to || r.date <= filter.to) &&
      (!filter.category || r.category === filter.category) &&
      (!filter.actor || r.actor === filter.actor),
  );
  const actors = [
    ...new Map(events.map((e) => [e.actor, e.actorName])).entries(),
  ];
  async function exportRows(format, data = filtered) {
    const values = data.map((r) => ({
      Tarih: r.date,
      Tür: types[r.type],
      Kategori: r.category || "",
      Kişi: r.party || "",
      "Tutar (TL)": r.amount / 100,
      "Ödeme yöntemi": r.method || "",
      Açıklama: r.note || "",
      Ortak: actors.find((a) => a[0] === r.actor)?.[1] || r.actor,
    }));
    await exportTable(format, values, "gelir-gider");
  }
  async function exportTable(format, values, name) {
    if (!values.length) throw Error("Dışa aktarılacak kayıt yok.");
    if (format === "csv") {
      const quote = (x) =>
        '"' +
        String(x ?? "")
          .replace(/^[=+@-]/, "'$&")
          .replaceAll('"', '""') +
        '"';
      download(
        name + ".csv",
        "\uFEFF" +
          [Object.keys(values[0]), ...values.map(Object.values)]
            .map((row) => row.map(quote).join(";"))
            .join("\r\n"),
        "text/csv;charset=utf-8",
      );
    } else {
      const { default: ExcelJS } = await import("exceljs");
      const book = new ExcelJS.Workbook(),
        sheet = book.addWorksheet("Kayıtlar");
      sheet.columns = Object.keys(values[0]).map((key) => ({
        header: key,
        key,
        width: 24,
      }));
      sheet.addRows(values);
      download(
        name + ".xlsx",
        await book.xlsx.writeBuffer(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    }
  }
  function Rows({ items = filtered }) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>İşlem / açıklama</th>
              <th>Kategori</th>
              <th>Tarih</th>
              <th>Kaydeden</th>
              <th className="right">Tutar</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="transaction-name">
                    <span
                      className={
                        "round " +
                        (["income", "capital", "opening"].includes(r.type)
                          ? "green"
                          : "red")
                      }
                    >
                      {["income", "capital", "opening"].includes(r.type) ? (
                        <ArrowDownLeft size={17} />
                      ) : (
                        <ArrowUpRight size={17} />
                      )}
                    </span>
                    <div>
                      <strong>{r.party || r.note || types[r.type]}</strong>
                      <small>
                        {types[r.type]} · {r.method || "Nakit"}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="tag">{r.category || types[r.type]}</span>
                </td>
                <td>
                  {new Date(r.date + "T12:00:00").toLocaleDateString("tr-TR")}
                </td>
                <td>{actors.find((a) => a[0] === r.actor)?.[1] || r.actor}</td>
                <td
                  className={
                    "right amount " +
                    (["income", "capital", "opening"].includes(r.type)
                      ? "positive"
                      : "negative")
                  }
                >
                  {["income", "capital", "opening"].includes(r.type)
                    ? "+"
                    : "−"}
                  {money(r.amount)}
                </td>
                <td>
                  {!r.jobId && (
                    <button
                      className="text-button"
                      onClick={() =>
                        setModal({ kind: "transaction", record: r })
                      }
                    >
                      Düzenle
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <Empty
            text="Henüz işlem yok"
            detail="İlk gelir veya giderinizi ekleyerek defterinizi tutmaya başlayın."
          />
        )}
      </div>
    );
  }
  if (!authReady) return <div className="login">Hesap kontrol ediliyor…</div>;
  if (!identity)
    return (
      <div className="login">
        <div className="login-card">
          <div className="brand">
            <BookOpen /> Atölye Defteri
          </div>
          <h1>
            İşinizin hesabı,
            <br />
            bir arada.
          </h1>
          <p>İki ortak için sade bir gelir–gider defteri.</p>
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
          {cloud ? (
            <form onSubmit={attempt(signIn)}>
              <Field label="E-posta" name="email" type="email" required />
              <Field label="Şifre" name="password" type="password" required />
              <button className="primary">Giriş yap</button>
            </form>
          ) : (
            <div className="setup-note">
              <CloudOff />
              <p>
                Bulut bağlantısı henüz kurulmadı. Yerel çalışma alanındaki
                veriler yalnızca bu tarayıcıda saklanır. İki hesap ve cihaz
                senkronizasyonu için README kurulumunu tamamlayın.
              </p>
            </div>
          )}
          <button
            className="secondary"
            onClick={() =>
              setIdentity({
                id: "local-user",
                name: "Yerel kullanıcı",
                local: true,
              })
            }
          >
            Yerel çalışma alanını aç
          </button>
          <small>Yerel alan bir kullanıcı doğrulama sistemi değildir.</small>
        </div>
      </div>
    );
  return (
    <div className="app">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-icon">
            <BookOpen size={22} />
          </span>
          <div>
            Atölye Defteri<small>İŞİNİZİN HESABI BURADA</small>
          </div>
        </div>
        <div className="workspace">
          <span className="avatar">AD</span>
          <div>
            <strong>Atölyem</strong>
            <small>Ortak çalışma alanı</small>
          </div>
        </div>
        <div className="nav-label">ÇALIŞMA ALANI</div>
        <nav>
          {tabs.map(([name, Icon]) => (
            <button
              key={name}
              className={tab === name ? "selected" : ""}
              onClick={() => {
                setTab(name);
                setMobile(false);
              }}
            >
              <Icon size={19} />
              {name}
              {tab === name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sync-card">
            <span className={"status-dot " + (!online ? "offline" : "")} />
            <strong>
              {identity.local
                ? "Yerel çalışma alanı"
                : !online
                  ? "Çevrimdışı"
                  : pending
                    ? `${pending} işlem bekliyor`
                    : "Bulut bağlantısı"}
            </strong>
            <small>
              {identity.local
                ? "Bu cihazda kayıtlı"
                : syncStatus || "Bağlantı kontrol ediliyor"}
            </small>
          </div>
          <button
            className="profile"
            onClick={attempt(async () => {
              if (cloud && session) await cloud.auth.signOut();
              setIdentity(null);
              setSession(null);
              setPassword("");
            })}
          >
            <span className="avatar">
              {identity.name.slice(0, 2).toUpperCase()}
            </span>
            <span>
              {identity.name}
              <small>Yönetici</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            <button
              className="icon-button menu"
              aria-label="Menüyü aç"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
            Çalışma alanı <ChevronRight size={14} /> <strong>{tab}</strong>
          </div>
          <div className="header-date">
            {new Date().toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Europe/Istanbul",
            })}
            <span className="header-avatar">{identity.name.slice(0, 1)}</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">ATÖLYENİZİN DEFTERİ</div>
              <h1>{tab === "Özet" ? "Genel bakış" : tab}</h1>
              <p>
                {tab === "Özet"
                  ? "Geliriniz, gideriniz ve atölyenizin bugünkü durumu."
                  : "Kayıtlarınız düzenli, işiniz kontrolünüzde."}
              </p>
            </div>
            <button
              className="primary"
              onClick={() =>
                setModal({
                  kind:
                    tab === "Stok"
                      ? "stock"
                      : tab === "Personel"
                        ? "staff"
                        : tab === "Taksitli işler"
                          ? "job"
                          : "transaction",
                })
              }
            >
              <Plus size={18} />{" "}
              {tab === "Stok"
                ? "Malzeme ekle"
                : tab === "Personel"
                  ? "Personel ekle"
                  : tab === "Taksitli işler"
                    ? "Yeni iş"
                    : "Yeni işlem"}
            </button>
          </div>
          {identity.local && (
            <div className="info">
              <CloudOff size={17} /> Yerel çalışma alanı · Kayıtlar bu cihazda
              saklanır. Bulut senkronizasyonu bağlı değil.
            </div>
          )}
          {error && (
            <div role="alert" className="alert">
              {error}
              <button aria-label="Hatayı kapat" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button
                aria-label="Bildirimi kapat"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!!state.conflicts.length && (
            <div className="alert">
              {state.conflicts.length} çakışan kayıt var. Bu kayıtlar çözülene
              kadar tutarlara dahil edilmez.
              <button onClick={() => setTab("İşlem geçmişi")}>İncele</button>
            </div>
          )}
          {tab === "Özet" && (
            <>
              <section className="stats">
                <article className="balance">
                  <div className="stat-label">
                    Toplam kasa <Wallet size={19} />
                  </div>
                  <strong>{money(summary.balance)}</strong>
                  <span>Atölyenizin güncel bakiyesi</span>
                  <div className="balance-bottom">
                    <span className="status-dot" /> Tüm para hareketleri dahil
                  </div>
                </article>
                {[
                  [
                    "Bu ay gelir",
                    summary.income,
                    ArrowDownLeft,
                    "green",
                    "Gerçekleşen tahsilatlar",
                  ],
                  [
                    "Bu ay gider",
                    summary.expense,
                    ArrowUpRight,
                    "red",
                    "İşletme giderleri",
                  ],
                  [
                    "Bu ay fark",
                    summary.difference,
                    ArrowLeftRight,
                    "neutral",
                    "Gelir − gider",
                  ],
                ].map(([label, value, Icon, color, detail]) => (
                  <article className="stat" key={label}>
                    <div className="stat-label">
                      {label}
                      <span className={"round " + color}>
                        <Icon size={18} />
                      </span>
                    </div>
                    <strong>{money(value)}</strong>
                    <span>{detail}</span>
                    <div className="stat-footer">
                      {new Date().toLocaleDateString("tr-TR", {
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </article>
                ))}
              </section>
              <section className="overview-secondary">
                <article className="receivable">
                  <div className="round neutral">
                    <CalendarDays size={22} />
                  </div>
                  <div>
                    <span>Müşterilerden kalan alacak</span>
                    <strong>{money(summary.receivable)}</strong>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setTab("Taksitli işler")}
                  >
                    İşleri görüntüle <ChevronRight size={16} />
                  </button>
                </article>
                <article className="receivable overdue">
                  <div className="round amber">
                    <History size={22} />
                  </div>
                  <div>
                    <span>Vadesi geçen taksitler</span>
                    <strong>{money(summary.overdue)}</strong>
                  </div>
                  <span className="tag amber">
                    {summary.overdue ? "Takip gerekiyor" : "Gecikme yok"}
                  </span>
                </article>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Son işlemler</h2>
                    <p>Atölyenizin en son para hareketleri</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setTab("Gelir ve gider")}
                  >
                    Tüm işlemler <ChevronRight size={16} />
                  </button>
                </div>
                <Rows items={rows.slice(0, 6)} />
              </section>
              <div className="bottom-note">
                <ShieldCheck size={16} /> Her kayıt ve değişiklik işlem
                geçmişinde korunur.
              </div>
            </>
          )}
          {tab === "Gelir ve gider" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Para hareketleri</h2>
                <div className="actions">
                  <button
                    className="secondary"
                    onClick={() => setModal({ kind: "category" })}
                  >
                    Kategori ekle
                  </button>
                  <button
                    className="secondary"
                    onClick={attempt(() => exportRows("csv"))}
                  >
                    <Download size={16} /> CSV
                  </button>
                </div>
              </div>
              <div className="filters">
                <Field
                  label="Başlangıç"
                  type="date"
                  value={filter.from}
                  onChange={(e) =>
                    setFilter({ ...filter, from: e.target.value })
                  }
                />
                <Field
                  label="Bitiş"
                  type="date"
                  value={filter.to}
                  onChange={(e) => setFilter({ ...filter, to: e.target.value })}
                />
                <Field label="Kategori">
                  <select
                    value={filter.category}
                    onChange={(e) =>
                      setFilter({ ...filter, category: e.target.value })
                    }
                  >
                    <option value="">Tümü</option>
                    {[
                      ...new Set([
                        ...categoryList,
                        ...rows.map((r) => r.category).filter(Boolean),
                        "İş tahsilatı",
                      ]),
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Ortak">
                  <select
                    value={filter.actor}
                    onChange={(e) =>
                      setFilter({ ...filter, actor: e.target.value })
                    }
                  >
                    <option value="">Tümü</option>
                    {actors.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Rows />
              <div className="category-list">
                Özel kategoriler:{" "}
                {categoryRecords.map((c) => (
                  <button
                    key={c.id}
                    className="tag"
                    onClick={() => setModal({ kind: "category", record: c })}
                  >
                    {c.name} · Düzenle
                  </button>
                ))}
              </div>
            </section>
          )}
          {tab === "Taksitli işler" && (
            <div className="cards">
              {!state.job.length && (
                <Empty
                  text="İlk işinizi ekleyin"
                  detail="Satış tutarı alacak olarak izlenir. Yalnızca tahsil edilen para kasaya girer."
                />
              )}
              {state.job.map((j) => {
                const paid = j.payments.reduce((a, p) => a + p.amount, 0);
                let alloc = Math.max(0, paid - j.deposit);
                return (
                  <article className="panel job-card" key={j.id}>
                    <div className="panel-heading">
                      <div>
                        <h2>{j.customer}</h2>
                        <p>{j.description}</p>
                      </div>
                      <span className="tag">
                        {j.total === paid ? "Tamamlandı" : "Devam ediyor"}
                      </span>
                    </div>
                    <div className="job-amounts">
                      <div>
                        Satış<strong>{money(j.total)}</strong>
                      </div>
                      <div>
                        Tahsil edilen
                        <strong className="positive">{money(paid)}</strong>
                      </div>
                      <div>
                        Kalan borç<strong>{money(j.total - paid)}</strong>
                      </div>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${(100 * paid) / j.total}%` }} />
                    </div>
                    <div className="installments">
                      {j.schedule.map((s, i) => {
                        const left = Math.max(0, s.amount - alloc);
                        alloc = Math.max(0, alloc - s.amount);
                        return (
                          <div key={i}>
                            <span>
                              {i + 1}. taksit · {s.date}
                            </span>
                            <strong>{money(s.amount)}</strong>
                            <span
                              className={
                                "tag " +
                                (!left
                                  ? "green"
                                  : s.date < today()
                                    ? "red"
                                    : "")
                              }
                            >
                              {!left
                                ? "Ödendi"
                                : (s.date < today()
                                    ? "Gecikmiş · "
                                    : "Kalan · ") + money(left)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <details>
                      <summary>Tahsilat geçmişi ({j.payments.length})</summary>
                      {j.payments.map((p) => (
                        <div className="history-row" key={p.id}>
                          {p.date} · {money(p.amount)} ·{" "}
                          {actors.find((a) => a[0] === p.actor)?.[1]}{" "}
                          <button
                            className="text-button"
                            onClick={() =>
                              setModal({
                                kind: "payment",
                                record: j,
                                paymentId: p.id,
                              })
                            }
                          >
                            Düzelt
                          </button>
                        </div>
                      ))}
                    </details>
                    <div className="card-actions">
                      <button
                        className="secondary"
                        onClick={() => setModal({ kind: "job", record: j })}
                      >
                        İşi düzenle
                      </button>
                      {paid < j.total && (
                        <button
                          className="primary"
                          onClick={() =>
                            setModal({ kind: "payment", record: j })
                          }
                        >
                          <Plus size={16} /> Tahsilat ekle
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {tab === "Stok" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Malzemeler</h2>
                <span className="tag">
                  {state.stock.filter((s) => s.active).length} aktif malzeme
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Malzeme adı</th>
                      <th>Birim</th>
                      <th>Miktar</th>
                      <th>Durum</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.stock.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.name}</strong>
                        </td>
                        <td>{s.unit}</td>
                        <td className="amount">
                          {s.quantity.toLocaleString("tr-TR")}
                        </td>
                        <td>
                          <span className={"tag " + (s.active ? "green" : "")}>
                            {s.active ? "Aktif" : "Pasif"}
                          </span>
                        </td>
                        <td>
                          <div className="actions">
                            <button
                              className="text-button"
                              onClick={() =>
                                setModal({ kind: "stock-adjust", record: s })
                              }
                            >
                              Miktar değiştir
                            </button>
                            <button
                              className="text-button"
                              onClick={() =>
                                setModal({ kind: "stock", record: s })
                              }
                            >
                              Düzenle
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!state.stock.length && (
                  <Empty
                    text="Stok listeniz hazır"
                    detail="Malzeme adı, birimi ve miktarını girmeniz yeterli."
                  />
                )}
              </div>
            </section>
          )}
          {tab === "Personel" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Atölye ekibi</h2>
                <span className="tag">
                  {state.staff.filter((s) => s.active).length} aktif personel
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ad soyad</th>
                      <th>Görev</th>
                      <th>Telefon</th>
                      <th>Giriş / ayrılış</th>
                      <th>Durum</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.staff.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.name}</strong>
                        </td>
                        <td>{s.role}</td>
                        <td>{s.phone || "—"}</td>
                        <td>
                          {s.start}
                          <small>{s.end || "Çalışmaya devam ediyor"}</small>
                        </td>
                        <td>
                          <span className={"tag " + (s.active ? "green" : "")}>
                            {s.active ? "Aktif" : "Ayrıldı"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() =>
                              setModal({ kind: "staff", record: s })
                            }
                          >
                            Düzenle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!state.staff.length && (
                  <Empty
                    text="Ekibinizi ekleyin"
                    detail="Ayrılan personelin kayıtları da geçmişte korunur."
                  />
                )}
              </div>
            </section>
          )}
          {tab === "Raporlar" && (
            <Reports
              state={state}
              events={events}
              rows={rows}
              exportTable={exportTable}
              attempt={attempt}
              actors={actors}
            />
          )}
          {tab === "İşlem geçmişi" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Çakışma kontrolü</h2>
                  <button className="secondary" onClick={attempt(doSync)}>
                    <RefreshCw size={16} /> Eşitle
                  </button>
                </div>
                {!state.conflicts.length ? (
                  <div className="padded positive">Çakışan kayıt yok.</div>
                ) : (
                  state.conflicts.map((c) => (
                    <div className="conflict" key={c.entity}>
                      <h3>
                        {c.kind} · {c.entity}
                      </h3>
                      <p>
                        İki farklı değişiklik var. Doğru sürümü seçin. Diğer
                        sürüm geçmişte saklanır.
                      </p>
                      {c.versions.map((v) => (
                        <div className="conflict-version" key={v.id}>
                          <strong>
                            {v.actorName} ·{" "}
                            {new Date(v.at).toLocaleString("tr-TR")}
                          </strong>
                          <pre>{JSON.stringify(v.data, null, 2)}</pre>
                          <button
                            className="secondary"
                            onClick={attempt(() =>
                              save(
                                c.kind,
                                v.data,
                                { id: c.entity },
                                c.versions.map((e) => e.id),
                              ),
                            )}
                          >
                            Bu sürümü kullan
                          </button>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </section>
              <section className="panel history-panel">
                <div className="panel-heading">
                  <h2>Değiştirilemez işlem günlüğü</h2>
                  <span className="tag">{events.length} işlem</span>
                </div>
                {[...events]
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .map((e) => (
                    <details className="audit" key={e.id}>
                      <summary>
                        <span className="round neutral">
                          <History size={16} />
                        </span>
                        <strong>{e.actorName}</strong>
                        <span>
                          {
                            {
                              transaction: "Para hareketi",
                              job: "Taksitli iş",
                              stock: "Stok",
                              staff: "Personel",
                              category: "Kategori",
                            }[e.kind]
                          }{" "}
                          ·{" "}
                          {e.data.cancelled
                            ? "İptal"
                            : e.parents.length
                              ? "Düzenleme"
                              : "Ekleme"}
                        </span>
                        <small>{new Date(e.at).toLocaleString("tr-TR")}</small>
                      </summary>
                      <pre>{JSON.stringify(e, null, 2)}</pre>
                    </details>
                  ))}
                {!events.length && (
                  <Empty
                    text="Henüz işlem yok"
                    detail="Eklemeler, düzenlemeler ve iptaller burada görünecek."
                  />
                )}
              </section>
            </>
          )}
          <div hidden={tab !== "Yedekleme"}>
            <FolderBackup
              db={dbRef.current}
              scope={scope}
              password={password}
              events={events}
            />
          </div>
          {tab === "Yedekleme" && (
            <section className="panel padded backup">
              <h2>Şifreli yedekleme</h2>
              <p>
                Yedekler AES-256-GCM ile şifrelenir. Parolanızı kaybederseniz
                yedek açılamaz. Parola yalnızca bu oturum boyunca bellekte
                tutulur.
              </p>
              <Field
                label="Yedek parolası (en az 12 karakter)"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div className="info">
                {password.length >= 12
                  ? "Oturum açıkken günlük otomatik yedek etkin."
                  : "Otomatik yedek için parolanızı girin."}{" "}
                {identity.local
                  ? "Bulut yedeği bağlı değil."
                  : "Şifreli yedekler ayrıca buluta gönderilir."}
              </div>
              <p>
                Son cihaz yedeği:{" "}
                {lastBackup
                  ? new Date(lastBackup).toLocaleString("tr-TR")
                  : "Henüz yok"}
              </p>
              {(!lastManual ||
                Date.now() - Date.parse(lastManual) > 604800000) && (
                <div className="alert">
                  Haftalık yönetici yedeğinizi indirip güvenli bir yerde
                  saklayın.
                </div>
              )}
              <div className="actions">
                <button
                  className="primary"
                  onClick={attempt(async () => {
                    const file = await encryptBackup(events, password, scope);
                    await dbRef.current.backups.add({
                      id: crypto.randomUUID(),
                      at: new Date().toISOString(),
                      reason: "manual",
                      file,
                      uploaded: false,
                    });
                    download(
                      `atolye-yedek-${today()}.json`,
                      JSON.stringify(file),
                    );
                    await load();
                    setNotice("Şifreli tam veri yedeği indirildi.");
                  })}
                >
                  <Download size={17} /> Tam JSON yedeği indir
                </button>
                <label className="secondary file-button">
                  Yedekten geri yükle
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={attempt(async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      if (file.size > 25 * 1024 * 1024)
                        throw Error("Yedek en fazla 25 MB olabilir.");
                      const result = await restore(
                        dbRef.current,
                        JSON.parse(await file.text()),
                        password,
                        scope,
                      );
                      await load();
                      setNotice(
                        `Bütünlük doğrulandı. Önce: ${result.before}, sonra: ${result.after} işlem. ${result.imported} yeni işlem birleştirildi. Mevcut veriler ayrıca şifreli korundu.`,
                      );
                      doSync();
                    })}
                  />
                </label>
              </div>
              <p>
                Geri yükleme mevcut kayıtları silmez; benzersiz işlem
                kimlikleriyle birleştirir. Önceki durumun şifreli güvenlik
                kopyası bu cihazda tutulur.
              </p>
              <h3>Cihazdaki yedekler</h3>
              <button
                className="secondary"
                onClick={attempt(async () => {
                  const backups = await dbRef.current.backups.toArray();
                  if (!backups.length) throw Error("Cihaz yedeği yok.");
                  for (const b of backups)
                    download(
                      `atolye-${b.reason}-${b.at.slice(0, 10)}-${b.id.slice(0, 6)}.json`,
                      JSON.stringify(b.file),
                    );
                })}
              >
                Cihaz yedeklerini indir
              </button>
              {!identity.local && (
                <>
                  <h3>Bulut yedekleri</h3>
                  <button
                    className="secondary"
                    onClick={attempt(async () => {
                      const { data, error } = await cloud
                        .from("backups")
                        .select("id,created_at,payload")
                        .eq("workspace_id", workspace)
                        .order("created_at", { ascending: false })
                        .limit(20);
                      if (error) throw error;
                      setCloudBackups(data);
                    })}
                  >
                    Bulut yedeklerini listele
                  </button>
                  {cloudBackups.map((b) => (
                    <div key={b.id}>
                      <button
                        className="text-button"
                        onClick={() =>
                          download(
                            `bulut-yedek-${b.created_at}.json`,
                            JSON.stringify(b.payload),
                          )
                        }
                      >
                        {new Date(b.created_at).toLocaleString("tr-TR")} · İndir
                      </button>
                    </div>
                  ))}
                </>
              )}
            </section>
          )}
        </div>
        <footer>
          Atölye Defteri <span>Sade kayıtlar. Net hesaplar.</span>
        </footer>
      </main>
      {modal && (
        <Editor
          modal={modal}
          close={() => setModal(null)}
          save={save}
          attempt={attempt}
          categoryList={categoryList}
          actor={identity.id}
          error={error}
          setError={setError}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js")
      .catch(console.error),
  );
