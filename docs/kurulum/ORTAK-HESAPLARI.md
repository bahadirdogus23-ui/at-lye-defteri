# Ortak hesapları — kurulum bekliyor

Kullanıcı kişisel e-posta istemiyor. Giriş ekranı `israfil` / `oktay` kullanıcı adlarını aşağıdaki teknik Supabase Auth adreslerine eşler. Bu adresler e-posta teslimatı için kullanılmaz; gerçek e-posta hesabı gerekmez.

| Kullanıcı adı | Görünen ad     | Teknik Auth adresi             |
| ------------- | -------------- | ------------------------------ |
| israfil       | İsrafil Şenman | israfil@atolye-defteri.invalid |
| oktay         | Oktay Demir    | oktay@atolye-defteri.invalid   |

İki ortak da v2.1 gereği yönetici yetkisine sahiptir. “Ana usta” ve “yardımcı ortak” ifadeleri erişim yetkilerini azaltmaz.

Bu dosya hesap oluşturulduğunu kanıtlamaz. Supabase yönetim erişimiyle **hedef proje `ojemwqkycabuodmhbsui` üzerinde** kurulum yapılmalıdır. Önce mevcut veriler kontrol edilip değişiklik öncesi yedek alınır. Başka projelere dokunulmaz.

Auth Admin `createUser` ile iki teknik adrese, birbirinden farklı güvenli başlangıç şifreleriyle ve `email_confirm: true` ile hesap açılır. Bu teknik adreslere davet/e-posta doğrulaması gönderilmez. Başlangıç şifreleri kaynak koda veya günlüklere yazılmaz; gerçek oluşturma tamamlanmadan giriş bilgisi çalışıyormuş gibi sunulmaz. Kullanıcılar oturum açınca **Şifremi değiştir** düğmesiyle kendi parolalarını belirleyebilir. E-posta ile şifre sıfırlama kullanılamaz; unutulan şifreyi yetkili Supabase yöneticisi Auth Admin üzerinden sıfırlar.

Hesapların gerçek Auth UUID değerleri tek işletmeye `members` tablosu üzerinden bağlanır. Şema kurulmamışsa `supabase/schema.sql` yalnızca boş proje ve doğrulanmış yedek şartları gözetilerek uygulanır. Aynı adrese mevcut hesap varsa yeniden oluşturulmaz; doğru hesaba üyelik verilir. Açık kayıt kapalı tutulur.

Ardından iki gerçek oturumla giriş/çıkış, şifre değiştirme, kasa eşitliği, çevrimdışı kayıt, mükerrer paket ve çakışma testleri yapılır. Veritabanı/proje şifresi kullanıcıların uygulama şifresi değildir ve tarayıcıya konmaz.
