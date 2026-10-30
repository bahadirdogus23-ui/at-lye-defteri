export const partnerAccounts = [
  {
    username: "israfil",
    name: "İsrafil Şenman",
    email: "israfil@atolye-defteri.invalid",
  },
  {
    username: "oktay",
    name: "Oktay Demir",
    email: "oktay@atolye-defteri.invalid",
  },
];
export function loginAddress(username) {
  const value = String(username || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const account = partnerAccounts.find((a) => a.username === value);
  if (account) return account.email;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return value;
  throw Error("Kullanıcı adınızı israfil veya oktay olarak girin.");
}
export async function changeAccountPassword(client, password, confirmation) {
  if (password.length < 12) throw Error("Yeni şifre en az 12 karakter olmalı.");
  if (password !== confirmation) throw Error("Yeni şifreler uyuşmuyor.");
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}
