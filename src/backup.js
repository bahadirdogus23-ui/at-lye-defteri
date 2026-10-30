import { mergeEvents } from "./domain.js";
const bytesTo64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};
const from64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function key(password, salt) {
  if (password.length < 12)
    throw Error("Yedek parolası en az 12 karakter olmalı.");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptBackup(events, password, scope) {
  mergeEvents([], events);
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = JSON.stringify({
    version: 1,
    scope,
    events,
    count: events.length,
  });
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(password, salt),
    new TextEncoder().encode(plain),
  );
  return {
    version: 1,
    salt: bytesTo64(salt),
    iv: bytesTo64(iv),
    ciphertext: bytesTo64(encrypted),
  };
}
export async function decryptBackup(file, password, scope) {
  if (file.version !== 1) throw Error("Desteklenmeyen yedek sürümü.");
  let data;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: from64(file.iv) },
      await key(password, from64(file.salt)),
      from64(file.ciphertext),
    );
    data = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw Error("Yedek parolası yanlış veya dosya bozulmuş.");
  }
  if (
    data.version !== 1 ||
    data.scope !== scope ||
    !Array.isArray(data.events) ||
    data.count !== data.events.length
  )
    throw Error("Yedek işletmesi veya kayıt sayısı uyuşmuyor.");
  mergeEvents([], data.events);
  return data.events;
}
