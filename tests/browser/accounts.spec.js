import { test, expect } from "@playwright/test";
test("kullanıcı adıyla giriş ve oturum içinden şifre değiştirme arayüzü", async ({
  page,
}) => {
  const id = "11111111-1111-4111-8111-111111111111";
  const workspace = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const user = {
    id,
    email: "israfil@atolye-defteri.invalid",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const jwt =
    [
      { alg: "HS256", typ: "JWT" },
      {
        sub: id,
        aud: "authenticated",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    ]
      .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
      .join(".") + ".test-signature";
  let loginEmail, changedPassword;
  await page.route(
    "https://ojemwqkycabuodmhbsui.supabase.co/**",
    async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      let data;
      if (url.pathname === "/auth/v1/token") {
        loginEmail = request.postDataJSON().email;
        data = {
          access_token: jwt,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "test-refresh-token",
          user,
        };
      } else if (url.pathname === "/auth/v1/user") {
        if (request.method() === "PUT")
          changedPassword = request.postDataJSON().password;
        data = user;
      } else if (url.pathname === "/rest/v1/members")
        data = [{ workspace_id: workspace, display_name: "İsrafil Şenman" }];
      else if (url.pathname === "/rest/v1/rpc/read_ledger") data = [];
      else data = [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    },
  );
  await page.goto("./");
  await page.getByLabel("Kullanıcı adı", { exact: true }).fill("israfil");
  await page.getByLabel("Şifre", { exact: true }).fill("test-ilk-sifre-123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Genel bakış" }),
  ).toBeVisible();
  expect(loginEmail).toBe("israfil@atolye-defteri.invalid");
  await page
    .getByRole("button", { name: "Şifremi değiştir", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Yeni şifre", { exact: true })
    .fill("test-yeni-sifre-456");
  await dialog
    .getByLabel("Yeni şifreyi tekrar gir", { exact: true })
    .fill("test-farkli-sifre-789");
  await dialog
    .getByRole("button", { name: "Şifreyi değiştir", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("uyuşmuyor");
  expect(changedPassword).toBeUndefined();
  await dialog
    .getByLabel("Yeni şifreyi tekrar gir", { exact: true })
    .fill("test-yeni-sifre-456");
  await dialog
    .getByRole("button", { name: "Şifreyi değiştir", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Hesap şifreniz değiştirildi",
  );
  expect(changedPassword).toBe("test-yeni-sifre-456");
});
