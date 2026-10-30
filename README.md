# Atölye Defteri

İki ortak için gelir–gider, taksitli müşteri işleri, basit stok ve personel takibi. Kapsam: [v2.1](docs/GEREKSINIMLER-v2.1.md).

## Çalıştırma

Node.js 22 veya 24 kullanın (bu ortamda 24.19.0 ile doğrulandı).

```sh
cd /workspace/at-lye-defteri
npm ci
npm run dev
```

Supabase ayarlanmamışsa giriş ekranından **Yerel çalışma alanını aç** seçilir. Bu alan tarayıcıya özgüdür, hesap doğrulaması ve cihazlar arası senkronizasyon içermez. Gerçek verileri bulut bağlantısı kurulana kadar burada tutmanız önerilmez. Tarayıcı verilerini temizlemek yerel kayıtları siler; şifreli yedek indirin.

```sh
npm test
npm run build
npm run test:e2e
```

Tarayıcı testleri sistemdeki `/usr/bin/chromium` kullanır. Başka bir sistemde `CHROMIUM_PATH` ayarlayın. Üretim derlemesini yerelde incelemek için `npm run preview` çalıştırın. PWA ve çevrimdışı açılış üretim derlemesinde, HTTPS veya localhost üzerinden çalışır. İlk çevrimiçi açılışta uygulama dosyalarının önbelleğe alınması gerekir. Ortam zaten izoledir; geliştirme için ek Git worktree gerekmiyor.

## Supabase kurulumu

1. Yeni bir Supabase projesi açın. Var olan bir veritabanına işlem yapmadan önce platform yedeği/`pg_dump` alın, yedeğin geri yüklenebilirliğini doğrulayın. `supabase/schema.sql` yalnızca **boş proje** içindir; mevcut şema üzerinde tekrar çalıştırılmaz.
2. SQL Editor içinde `supabase/schema.sql` çalıştırın. Tablolar RLS ile korunur; kayıtlar yalnızca `append_events` RPC üzerinden eklenir. İstemcinin güncelleme/silme yetkisi yoktur.
3. Authentication → Users üzerinden iki ayrı kullanıcı oluşturun ve e-postalarını doğrulayın. Genel kullanıcı kaydını kapatın; yalnızca bu iki hesabı kullanın. Güçlü ve ayrı şifreler belirleyin.
4. Aşağıdaki SQL'de iki kullanıcının **gerçek UUID** değerlerini kullanın (parola veya anahtar yazılmaz):

```sql
with workspace as (
  insert into public.workspaces(name) values ('Atölyem') returning id
)
insert into public.members(workspace_id,user_id,display_name)
select id, 'BIRINCI_KULLANICI_UUID'::uuid, 'Birinci ortak' from workspace
union all
select id, 'IKINCI_KULLANICI_UUID'::uuid, 'İkinci ortak' from workspace;
```

Her kullanıcı tek işletmeye bağlanır. Üyelikleri ve ortak adlarını yönetici SQL üzerinden yönetir. Günlükte eski isimler korunduğu için ortak adı değişikliği bekleyen çevrimdışı paketler gönderilmeden yapılmamalıdır.

5. `.env.example` dosyasını `.env.local` olarak kopyalayın. Project Settings → API ekranındaki URL ve **public anon/publishable** anahtarını girin. **service_role/secret anahtarını VITE değişkenlerine veya tarayıcıya koymayın.**
6. `npm run build` ile yeniden derleyin. Bulut ortamı ağ ayarlarına yalnızca kendi proje alan adınızı (`PROJE.supabase.co`) ekleyin. Gerçek bir alan adı henüz verilmediği için ortam ağ listesi değiştirilmedi.
7. Telefon ve bilgisayarda aynı HTTPS dağıtımını açın, ayrı hesaplarla giriş yapın. Her iki cihaz ilk çevrimiçi girişten sonra çevrimdışı kayıt yapabilir. Oturum geçersiz kılındığında tekrar çevrimiçi giriş gerekebilir.

Bu çalışma sırasında Supabase projesi oluşturulmadı, SQL uzaktaki bir veritabanında çalıştırılmadı ve uygulama yayınlanmadı.

## Veri modeli ve senkronizasyon

- Para tam sayı kuruşla hesaplanır. Sermaye, açılış ve ortak çekişleri satış/gider raporlarından ayrıdır.
- Taksitli iş tek kayıt altında satış, vade planı ve tahsilatları tutar. Peşinat dahil yalnızca tahsilatlar kasaya girer. Son kuruşlar taksitlere dağıtılır; ay sonu tarihleri ayın son gününe sıkıştırılır.
- Her değişiklik benzersiz bir işlem ve kayıt kimliğine sahiptir. IndexedDB'ye önce kaydedilir. Gönderildi bilgisi ayrı saklanır; başarısız istek kayıtları silmez.
- Bulut açıkken 15 saniyede bir ve bağlantı geri geldiğinde eşitleme denenir. Paket aynı kimlikle tekrar gönderilebilir; sunucu aynı içeriği tek kere kabul eder. Aynı kimlikte farklı içerik reddedilir.
- Düzenlemeler önceki işlem kimliğini referans alır. Aynı kaydın iki cihazda farklı düzenlenmesi çakışma oluşturur. Hiçbir sürüm silinmez; kullanıcı geçmiş ekranından doğru sürümü seçer. Çakışan kayıtlar çözülene kadar kasa ve listelerden çıkarılır; ekranda açık uyarı vardır. Bu sırada özet bakiyeleri kesin hesap olarak kullanılmamalıdır.
- Stok değişiklikleri ve personeli pasifleştirme/yeniden aktifleştirme de aynı günlüğe girer.
- Düzenli çevrimdışı kullanım için uygulamayı aynı tarayıcı profilinde açın. Yerel çalışma alanı bulut işletmesinden ayrıdır; yerel deneme kayıtları kendiliğinden işletmeye taşınmaz.

## Yedekler

Yedekleme, senkronizasyon kuyruğundan bağımsızdır. Yedekleme ekranında en az 12 karakterlik parola girildiğinde açık oturum boyunca günlük otomatik şifreli cihaz yedeği oluşturulur. Bağlantı varsa şifreli kopyası ayrı bulut tablosuna yüklenir. Uygulama kapalıyken tarayıcı zamanlayıcıları çalışmaz; **kesintisiz sunucu yedeği için ayrıca zamanlanmış sunucu işi gerekir**. Sunucu işleyicisi ve [günlük zamanlayıcı kurulum yönergesi](docs/BULUT-YEDEK.md) hazır; gerçek projede işlev dağıtımı ve zamanlayıcı henüz etkinleştirilmedi.

AES-256-GCM, rastgele salt/IV ve PBKDF2-SHA256 (310.000 iterasyon) kullanılır. Parola yalnızca oturum belleğindedir; kaybedilirse yedek açılamaz. Haftalık yönetici yedeğini ayrıca JSON olarak indirip güvenli yerde tutun. CSV/Excel raporları şifreli tam yedeğin yerine geçmez.

Geri yükleme aynı işletmede yapılır: parola ve bütünlük doğrulanır, mevcut durumun şifreli kopyası alınır, işlemler kimliklerine göre birleştirilir. Mevcut kayıtlar silinmez. İşletme kimliği farklı, bozuk, eksik zincirli veya çarpışan işlem kimlikli yedek reddedilir. Önce/sonra kayıt sayısı raporlanır. Güvenlik kopyaları cihaz yedekleri bölümünden indirilebilir. Geri yüklenen ortak işlemleri sunucuda zaten mevcutsa yeniden gönderim mükerrer oluşturmaz; tamamen başka bir sunucuya felaket kurtarma için yönetici taraflı aktarım gerekir.

## Doğrulama ve kalan kabul adımları

`tests/domain.test.js`: kuruş, ay sonu vadesi, kasa/alacak ayrımı, sermaye, tekrar işleme, geçmiş koruma, çakışma çözümü.

`tests/storage.test.js`: IndexedDB kalıcılığı, şifreli yedek, yanlış parola/bozulma, geri yükleme öncesi koruma ve kayıt sayısı.

`tests/sql.test.js`: PGlite (gerçek PostgreSQL motoru) ile şema/RLS/RPC, yetkisiz okuma/yazma, sahte ortak, kimlik çarpışması ve iki bağımsız IndexedDB cihazının PostgreSQL üzerinden birleşmesi. Supabase Auth/ağ testi yerine geçmez.

`tests/browser`: Chromium ile gelir–gider düzeltme/iptal, taksit tahsilatı, stok azaltma, personel ayrılışı, mobil ekran, üretim PWA çevrimdışı açılışı ve Excel indirme.

Gerçek Supabase kurulumundan sonra iki farklı cihaz/hesapla giriş, ağ kesintisi sonrası eşitleme, çakışma çözümü, bulut yedeği indirme/geri yükleme ve tutar/kayıt sayısı eşitliği ayrıca sınanmalıdır. Gerçek telefon PWA kurulumu ve kapalı uygulama için sunucu yedek zamanlayıcısı da kabul öncesi tamamlanmalıdır. Bu dış bağlantılar doğrulanmadan v2.1'in tamamlandığı iddia edilmez.

## GitHub Pages yayını

`.github/workflows/pages.yml`, `main` dalına gönderimden sonra testleri ve üretim derlemesini çalıştırıp GitHub Pages'e dağıtır. PWA dosyaları depo alt dizinini destekler. Workflow, Pages'i açmayı dener; GitHub kuruluş/hesap yetkileri buna izin vermiyorsa depo sahibi **Settings → Pages → Source: GitHub Actions** seçmelidir. Özel depolarda GitHub planının Pages desteği gerekir; bu uygulama depoyu herkese açık hale getirmez.

Supabase proje değişkenleri yoksa yayın yerel çalışma alanıyla açılır. Gerçek iki ortak için depo **Settings → Secrets and variables → Actions → Variables** bölümüne `VITE_SUPABASE_URL` ve yalnızca public `VITE_SUPABASE_ANON_KEY` ekleyin. Supabase Auth Site URL ve yönlendirme izinlerinde gerçek HTTPS uygulama adresini kullanın. Sunucu anahtarları bu değişkenlere konmaz.

Alt dizinli yayını yerelde doğrulama:

```sh
BASE_PATH=/at-lye-defteri/ npm run build
BASE_PATH=/at-lye-defteri/ npm run test:e2e
```

Bulut geliştirme ortamını yayınlamak ile web sitesini GitHub Pages'e dağıtmak farklı işlemlerdir. GitHub Actions çalıştırması ve HTTPS adresinden başarılı yanıt gözlenmeden sitenin yayında olduğu varsayılmaz.

## Otomatik klasör yedeği

Bilgisayarda Chrome/Edge ile **Yedekleme** ekranında yedek parolasını girin ve **Yedek klasörü seç** düğmesiyle bir klasör seçip yazma izni verin. Uygulama açık kaldığı sürece diğer ekranlarda da veri değişikliklerinden yaklaşık iki saniye sonra şifreli tam JSON yedeği bu klasöre yazılır. Beş dakikada bir ve uygulamaya geri dönüldüğünde de kontrol edilir. Değişmeyen veri için aynı oturumda tekrar dosya yazılmaz; her yeni yedek ayrı isim taşır, önceki dosyalar silinmez.

Klasör seçimi IndexedDB'de hatırlanır. Her yeni oturumda yedek parolasını tekrar girin; tarayıcı isterse **Klasör iznini yenile** düğmesini kullanın. Parola diskte saklanmaz. Uygulama kapalıyken veya cihaz uyurken klasöre yedek yazılamaz. Safari/Firefox ve bu API'yi desteklemeyen telefon tarayıcılarında otomatik klasör erişimi yoktur; şifreli JSON indirme kullanılabilir. Klasörde biriken eski dosyaları siz yönetirsiniz. Bu yedekleri mevcut geri yükleme ekranından açabilirsiniz.
