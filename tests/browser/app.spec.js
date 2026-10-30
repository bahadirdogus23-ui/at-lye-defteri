import { test, expect } from "@playwright/test";
async function enter(page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Yerel çalışma alanını aç" }).click();
  await expect(
    page.getByRole("heading", { name: "Genel bakış" }),
  ).toBeVisible();
}
async function addCash(page, type, amount, party) {
  await page.getByRole("button", { name: "Yeni işlem" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("İşlem türü").selectOption(type);
  await dialog.getByLabel("Tutar (₺)").fill(amount);
  await dialog.getByLabel("Kimden / kime").fill(party);
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
test("gelir gider, düzeltme ve iptal geçmişi", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await addCash(page, "income", "1500,25", "Ahmet");
  await addCash(page, "expense", "250,10", "MDF alımı");
  await expect(page.locator(".balance>strong")).toHaveText("₺1.250,15");
  await page
    .locator("nav")
    .getByRole("button", { name: "Gelir ve gider", exact: true })
    .click();
  const row = page.getByRole("row").filter({ hasText: "Ahmet" });
  await row.getByRole("button", { name: "Düzenle" }).click();
  await page.getByRole("dialog").getByLabel("Tutar (₺)").fill("1600,25");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kaydet", exact: true })
    .click();
  await row.getByRole("button", { name: "Düzenle" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "İşlemi iptal et" })
    .click();
  await expect(row).toHaveCount(0);
  await page
    .locator("nav")
    .getByRole("button", { name: "İşlem geçmişi", exact: true })
    .click();
  await expect(page.locator(".audit")).toHaveCount(4);
  expect(errors).toEqual([]);
});
test("taksit, stok ve personel çalışır", async ({ page }) => {
  await enter(page);
  await page
    .locator("nav")
    .getByRole("button", { name: "Taksitli işler" })
    .click();
  await page.getByRole("button", { name: "Yeni iş", exact: true }).click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Müşteri adı").fill("Ayşe Yılmaz");
  await d.getByLabel("İşin açıklaması").fill("Mutfak dolabı");
  await d.getByLabel("Toplam satış").fill("10000");
  await d.getByLabel("Peşinat (₺)").fill("1000");
  await d.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.locator(".job-card")).toContainText("₺9.000,00");
  await page.getByRole("button", { name: "Tahsilat ekle" }).click();
  await page.getByLabel("Tahsil edilen tutar").fill("500");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kaydet", exact: true })
    .click();
  await expect(page.locator(".job-card")).toContainText("₺8.500,00");
  await page
    .locator("nav")
    .getByRole("button", { name: "Özet", exact: true })
    .click();
  await expect(page.locator(".balance>strong")).toHaveText("₺1.500,00");
  await page
    .locator("nav")
    .getByRole("button", { name: "Stok", exact: true })
    .click();
  await page.getByRole("button", { name: "Malzeme ekle" }).click();
  await page.getByLabel("Malzeme adı").fill("MDF");
  await page.getByLabel("Miktar", { exact: true }).fill("25");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kaydet", exact: true })
    .click();
  await page.getByRole("button", { name: "Miktar değiştir" }).click();
  await page.getByLabel("Değişim").fill("-5");
  await page.getByLabel("İşlem açıklaması").fill("Kullanım");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kaydet", exact: true })
    .click();
  await expect(page.getByRole("row").filter({ hasText: "MDF" })).toContainText(
    "20",
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "Personel", exact: true })
    .click();
  await page.getByRole("button", { name: "Personel ekle" }).click();
  await page.getByLabel("Ad soyad").fill("Mehmet Kaya");
  await page.getByLabel("Görev", { exact: true }).fill("Usta");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kaydet", exact: true })
    .click();
  await page.getByRole("button", { name: "Düzenle" }).click();
  await page.getByLabel("Durum").selectOption("false");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kaydet", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Mehmet Kaya" }),
  ).toContainText("Ayrıldı");
});
test("üretim PWA çevrimdışı açılır, kayıt ve Excel dışa aktarımı çalışır", async ({
  page,
  context,
}) => {
  await enter(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => {
    const cache = await caches.keys();
    return cache.some((k) => k.startsWith("atolye-"));
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Yerel çalışma alanını aç" }).click();
  await addCash(page, "income", "42,50", "Çevrimdışı müşteri");
  await page.reload();
  await page.getByRole("button", { name: "Yerel çalışma alanını aç" }).click();
  await expect(page.locator(".balance>strong")).toHaveText("₺42,50");
  await page.locator("nav").getByRole("button", { name: "Raporlar" }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel indir" }).first().click();
  expect((await dl).suggestedFilename()).toBe("Gelir-gider.xlsx");
});
test("mobil görünümde taşma yok, menü çalışır", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Stok", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Stok", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("kategori düzenleme, şifreli yedek ve geri yükleme bütünlüğü", async ({
  page,
}) => {
  await enter(page);
  await addCash(page, "income", "100", "İlk müşteri");
  await page
    .locator("nav")
    .getByRole("button", { name: "Gelir ve gider", exact: true })
    .click();
  await page
    .getByRole("button", { name: "MDF · Düzenle", exact: true })
    .click();
  await page.getByLabel("Kategori adı").fill("Levha");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kaydet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Levha · Düzenle", exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Yedekleme", exact: true })
    .click();
  await page.getByLabel("Yedek parolası").fill("guvenli-yedek-parolasi-123");
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tam JSON yedeği indir" }).click();
  const file = await waiting;
  const path = await file.path();
  await page
    .locator("nav")
    .getByRole("button", { name: "Özet", exact: true })
    .click();
  await addCash(page, "expense", "25", "Yedek sonrası gider");
  await page
    .locator("nav")
    .getByRole("button", { name: "Yedekleme", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles(path);
  await expect(page.getByRole("status")).toContainText("Bütünlük doğrulandı");
  await page
    .locator("nav")
    .getByRole("button", { name: "Özet", exact: true })
    .click();
  await expect(page.locator(".balance>strong")).toHaveText("₺75,00");
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
});

test("tahsilat düzeltme ve iptal kasayı günceller, eski olayları korur", async ({
  page,
}) => {
  await enter(page);
  await page
    .locator("nav")
    .getByRole("button", { name: "Taksitli işler" })
    .click();
  await page.getByRole("button", { name: "Yeni iş", exact: true }).click();
  await page.getByLabel("Müşteri adı").fill("Test müşteri");
  await page.getByLabel("İşin açıklaması").fill("Masa");
  await page.getByLabel("Toplam satış").fill("1000");
  await page.getByLabel("Peşinat (₺)").fill("200");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kaydet", exact: true })
    .click();
  await page.getByText("Tahsilat geçmişi (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Düzelt", exact: true }).click();
  await page.getByLabel("Tahsil edilen tutar").fill("250");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kaydet", exact: true })
    .click();
  await expect(page.locator(".job-amounts")).toContainText("₺750,00");
  await page.getByRole("button", { name: "Düzelt", exact: true }).click();
  await page.getByRole("button", { name: "Tahsilatı iptal et" }).click();
  await expect(page.locator(".job-amounts")).toContainText("₺1.000,00");
  await page
    .locator("nav")
    .getByRole("button", { name: "Özet", exact: true })
    .click();
  await expect(page.locator(".balance>strong")).toHaveText("₺0,00");
  await page
    .locator("nav")
    .getByRole("button", { name: "İşlem geçmişi", exact: true })
    .click();
  await expect(page.locator(".audit")).toHaveCount(3);
});

test("klasör yedeği diğer ekranda da otomatik yazılır ve klasör hatırlanır", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle("test-yedekleri", { create: true });
    };
  });
  await enter(page);
  await addCash(page, "income", "100", "Klasör testi");
  await page
    .locator("nav")
    .getByRole("button", { name: "Yedekleme", exact: true })
    .click();
  await page.getByLabel("Yedek parolası").fill("klasor-yedek-parolasi-123");
  await page
    .getByRole("button", { name: "Yedek klasörü seç", exact: true })
    .click();
  await expect(page.locator(".folder-backup [role=status]")).toContainText(
    "klasöre kaydedildi",
  );
  async function files() {
    return page.evaluate(async () => {
      const dir = await (
        await navigator.storage.getDirectory()
      ).getDirectoryHandle("test-yedekleri");
      const values = [];
      for await (const [name, handle] of dir.entries())
        values.push({
          name,
          file: JSON.parse(await (await handle.getFile()).text()),
        });
      return values;
    });
  }
  const initial = await files();
  expect(initial).toHaveLength(1);
  await page
    .locator("nav")
    .getByRole("button", { name: "Özet", exact: true })
    .click();
  await addCash(page, "expense", "25", "Diğer ekranda değişiklik");
  await expect.poll(async () => (await files()).length).toBe(2);
  const { decryptBackup } = await import("../../src/backup.js");
  const all = await files();
  const restored = await Promise.all(
    all.map((f) => decryptBackup(f.file, "klasor-yedek-parolasi-123", "local")),
  );
  expect(restored.map((events) => events.length).sort()).toEqual([1, 2]);
  await page.reload();
  await page.getByRole("button", { name: "Yerel çalışma alanını aç" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Yedekleme", exact: true })
    .click();
  await expect(page.locator(".folder-backup")).toContainText("test-yedekleri");
  await page.getByLabel("Yedek parolası").fill("klasor-yedek-parolasi-123");
  await expect.poll(async () => (await files()).length).toBe(3);
  await page.getByRole("button", { name: "Otomatik yedeği durdur" }).click();
  await expect(page.locator(".folder-backup")).toContainText("Durduruldu");
});
