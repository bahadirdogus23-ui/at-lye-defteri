import { it, expect, vi } from "vitest";
import { loginAddress, changeAccountPassword } from "../src/account";
it("ortak adlarını teknik Auth adresine dönüştürür, kişisel e-posta istemez", () => {
  expect(loginAddress(" İsrafil ")).toBe("israfil@atolye-defteri.invalid");
  expect(loginAddress("OKTAY")).toBe("oktay@atolye-defteri.invalid");
  expect(loginAddress("test@example.com")).toBe("test@example.com");
  expect(() => loginAddress("bilinmeyen")).toThrow();
});
it("zayıf veya eşleşmeyen şifreyi sunucuya göndermeden reddeder", async () => {
  const client = { auth: { updateUser: vi.fn() } };
  await expect(changeAccountPassword(client, "kisa", "kisa")).rejects.toThrow();
  await expect(
    changeAccountPassword(client, "ornek-uzun-sifre", "farkli-uzun-sifre"),
  ).rejects.toThrow();
  expect(client.auth.updateUser).not.toHaveBeenCalled();
});
it("şifreyi Supabase oturum API üzerinden değiştirir, hatada başarı bildirmez", async () => {
  const client = {
    auth: { updateUser: vi.fn().mockResolvedValue({ error: null }) },
  };
  await changeAccountPassword(client, "ornek-uzun-sifre", "ornek-uzun-sifre");
  expect(client.auth.updateUser).toHaveBeenCalledWith({
    password: "ornek-uzun-sifre",
  });
  client.auth.updateUser.mockResolvedValue({ error: Error("Oturum geçersiz") });
  await expect(
    changeAccountPassword(client, "ornek-uzun-sifre", "ornek-uzun-sifre"),
  ).rejects.toThrow("Oturum geçersiz");
});
