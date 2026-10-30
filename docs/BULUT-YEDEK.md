# Uygulama kapalıyken günlük şifreli yedek

Bu kurulum gerçek Supabase projesi olmadığı için uzakta çalıştırılmadı. Sunucu işleyicisi yerel testlerle doğrulandı. İlk kurulumda projeye göre aşağıdaki adımlar gerekir; bu belge bir dağıtım yapmaz.

1. Önce README'deki boş proje şemasını kurun. Mevcut veritabanına değişiklik yapmadan önce doğrulanmış yönetici yedeği alın.
2. Supabase CLI ile projeyi bağlayıp `supabase functions deploy daily-backup` çalıştırın. İşlev JWT doğrulamasını açık bırakır.
3. Supabase Functions → Secrets ekranında `ATOLYE_BACKUP_PASSPHRASE` (en az 12 karakter, güvenli yerde ayrıca saklanan sunucu yedek parolası) ve `ATOLYE_BACKUP_TRIGGER_KEY` (rastgele, uzun, yalnızca zamanlayıcıya verilen çağrı anahtarı) oluşturun. Supabase'in sağladığı `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` işlev tarafından kullanılır. Hiçbirini `VITE_*` değişkenine koymayın. Parolayı değiştirmeden önce eski yedeklerin parolasını ayrıca koruyun. Sunucu parolası tarayıcı oturumu parolasından bağımsızdır.
4. Supabase Cron (`pg_cron`), `pg_net` ve Vault özelliklerini etkinleştirin. Vault arayüzünde aşağıdaki sırları oluşturun. Değerleri sohbete veya Git'e koymayın:
   - `atolye_backup_url`: `https://PROJE.supabase.co/functions/v1/daily-backup`
   - `atolye_backup_trigger`: işlevin `ATOLYE_BACKUP_TRIGGER_KEY` değeri
   - `atolye_service_role`: projenin JWT biçimli service_role anahtarı (yalnızca sunucu çağrısı için)
5. SQL Editor'da aşağıdaki tek günlük işi oluşturun (01:00 UTC = 04:00 Türkiye saati):

```sql
select cron.schedule('atolye-daily-backup', '0 1 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='atolye_backup_url'),
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='atolye_service_role'),
      'x-backup-key',(select decrypted_secret from vault.decrypted_secrets where name='atolye_backup_trigger')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
```

Aynı işi ikinci kez eklemeyin. Cron kaydı veya HTTP isteğinin kuyruğa alınması başarı kanıtı değildir. İlk çalıştırmadan sonra Cron çalıştırma geçmişini, `net._http_response` içindeki HTTP 200 durumunu ve `public.backups` tablosunda yeni şifreli satır oluştuğunu kontrol edin. Uygulama kapalıyken bu testi yapın. Başarısız günlük işlere yönetici bildirimi için Supabase operasyonel izleme yapılandırın.

İşleyici her işletmenin günlüğünü `read_ledger` RPC ile tek PostgreSQL anlık görüntüsünde okur, AES-GCM ile şifreler ve ayrı yedek tablosuna ekler. Senkronizasyon çalışmasa da yedekleme bağımsız çalışır. Bir işletmede hata oluşursa HTTP 500 döner; önceki başarılı işletme yedekleri korunur. Sırlar veya ham kayıtlar yanıt/log içine yazılmaz.

Yedekleme ekranında **Bulut yedeklerini listele** → JSON indir → sunucu yedek parolasıyla geri yükleme yapın. İşletme kimliği aynı olmalıdır. Kayıt sayısını, kasa/alacak tutarlarını ve işlem geçmişini iki cihazda doğrulayın. Haftalık indirilen yönetici yedeğini bulut hesabından bağımsız güvenli yerde koruyun.

Depolama, otomatik saklama süresi ve felaket kurtarma operasyonu işletme sahibi tarafından ayrıca yönetilir. Bu uygulama yedekleri fiziksel olarak silmez.
