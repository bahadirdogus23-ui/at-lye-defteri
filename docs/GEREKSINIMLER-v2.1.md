# ATÖLYE DEFTERİ
## İki Ortak İçin Basit Gelir–Gider Takip Uygulaması
**Nihai Yazılım Gereksinimleri – v2.1**

### 1. UYGULAMANIN AMACI

Atölye Defteri, aynı işletmeyi yöneten iki ortağın gelir ve giderlerini birlikte takip etmesini sağlayan basit bir uygulamadır.

Temel amaçlar:

- İşletmeye giren parayı kaydetmek.
- İşletmeden çıkan parayı kaydetmek.
- Hangi ortağın hangi işlemi kaydettiğini görmek.
- Müşterilerin taksitli borçlarını takip etmek.
- Kasada ne kadar para olduğunu görmek.
- Basit stok miktarlarını takip etmek.
- Personel listesini yönetmek.
- İki cihazdaki kayıtları kayıpsız birleştirmek.

Uygulama muhasebe bilgisi gerektirmemeli, herkes tarafından kolayca kullanılabilmelidir.

### 2. KULLANICI VE CİHAZLAR

İki ortak da yönetici yetkisine sahip olacaktır.

- Her ortağın kendisine ait kullanıcı hesabı bulunacak.
- İki ortak aynı kayıtları görebilecek.
- Her işlemin hangi ortak tarafından girildiği belli olacak.
- Her iki ortak kayıt ekleyebilecek ve düzeltebilecek.
- Değişikliklerin geçmişi korunacak.

Bir telefon ve bir bilgisayarda kullanılacaktır.

İnternet yokken de kayıt yapılabilmeli, bağlantı geldiğinde iki cihaz otomatik senkronize olmalıdır.

### 3. GELİR VE GİDER

Uygulamanın ana modülüdür.

**Gelir kaydı:**

- Tutar.
- Tarih.
- Gelir türü.
- Kimden geldiği (isteğe bağlı).
- Ödeme yöntemi.
- Açıklama.
- Kaydı giren ortak (otomatik).

**Gider kaydı:**

- Tutar.
- Tarih.
- Gider kategorisi.
- Kime veya nereye ödendiği (isteğe bağlı).
- Ödeme yöntemi.
- Açıklama.
- Kaydı giren ortak (otomatik).

Gider kategorileri kullanıcı tarafından eklenip düzenlenebilmelidir.

Örnek: MDF, hırdavat, yemek, kira, elektrik, nakliye, personel ve diğer.

**Ana kurallar:**

- Gelir ve gider kayıtları tek ekrandan kolayca görüntülenebilmelidir.
- Tarih, kategori ve ortak filtresi bulunmalıdır.
- Yanlış girilen kayıt düzeltilebilmelidir.
- Düzeltme ve iptal geçmişi saklanmalıdır.
- Kasa bakiyesi otomatik hesaplanmalıdır.

Kasa hesabı:

Açılış bakiyesi + tahsilatlar + diğer para girişleri − giderler − diğer para çıkışları.

Ortakların işletmeye koyduğu para ve işletmeden kişisel çekişleri, istenirse ayrı para hareketi olarak kaydedilmeli; satış geliri veya işletme gideriyle karıştırılmamalıdır.

### 4. TAKSİTLİ İŞLER

Bu özellik unutulmayacaktır.

Yeni iş oluştururken:

- Müşteri adı.
- İşin açıklaması.
- Toplam satış tutarı.
- Peşinat.
- Taksit sayısı.
- İlk taksit tarihi.
- Aylık taksit tutarı.

Program taksitleri otomatik hesaplamalıdır.

Her tahsilat kaydedildiğinde:
- Tahsil edilen tutar.
- Ödeme tarihi.
- Hangi işe ait olduğu.
- Kalan borç.

otomatik güncellenmelidir.

İşin taksitleri, ödenenleri ve vadesi geçenleri ayrı ayrı görülmelidir.

Önemli: Sipariş açıldığında toplam satış bedeli kasaya gelir olarak yazılmayacaktır. Gerçek tahsilatlar gelir kaydına alınacak, kalan kısım alacak olarak takip edilecektir. Böylece çift kayıt oluşmayacaktır.

### 5. BASİT STOK TAKİBİ

Stok sistemi kesinlikle basit olacaktır.

Yeni stok kaydı için yalnızca üç temel bilgi bulunacaktır:

| Alan | Örnek |
|---|---|
| Malzeme adı | MDF |
| Birim | Adet |
| Miktar | 25 |

Birim seçenekleri:
- Adet
- Metre

Yönetici istediği malzeme adını kendisi yazabilmelidir.

Örnek stok listesi:

| Malzeme | Birim | Miktar |
|---|---|---:|
| MDF | Adet | 25 |
| Kenar bandı | Metre | 300 |
| Menteşe | Adet | 120 |
| Ray | Adet | 40 |

İşlemler:
- Yeni stok ekleme.
- Stok miktarını artırma.
- Stok miktarını azaltma.
- Stok bilgilerini düzenleme.
- Stok kaydını pasifleştirme.

Her miktar değişikliği işlem geçmişinde tutulacaktır.

Stokta fiyat, maliyet, kategori zorunluluğu, otomatik üretim tüketimi veya karmaşık hesaplama olmayacaktır.

### 6. PERSONEL

Basit personel listesi tutulacaktır.

Personel kartında:
- Ad soyad.
- Görev.
- Telefon (isteğe bağlı).
- İşe giriş tarihi.
- İşten ayrılma tarihi.
- Aktif / pasif durumu.

İşlemler:
- Personel ekle.
- Personel bilgilerini düzenle.
- Personeli işten ayrıldı olarak işaretle.
- Eski personeli yeniden aktif et.
- Personel listesini görüntüle.

Geçmiş personel kayıtları silinmeyecektir.

Bu modülde resmî bordro, SGK, vergi hesabı, ayrıntılı puantaj veya karmaşık maaş algoritması bulunmayacaktır.

### 7. ANA EKRAN VE RAPORLAR

Uygulama açıldığında aşağıdaki bilgiler tek ekranda bulunmalıdır:

- Toplam kasa.
- Bu ay toplam gelir.
- Bu ay toplam gider.
- Bu ay gelir-gider farkı.
- Müşterilerden kalan alacak.
- Vadesi geçen taksitler.
- Son işlemler.

Raporlar:
- Günlük gelir-gider.
- Aylık gelir-gider.
- Yıllık gelir-gider.
- Kategoriye göre giderler.
- Ortaklara göre kayıt geçmişi.
- Müşteri bazında alacaklar.
- Stok listesi.
- Personel listesi.

Excel ve CSV dışa aktarma bulunacaktır.

### 8. İŞLEM GEÇMİŞİ VE VERİ GÜVENLİĞİ

Bu bölüm projenin en önemli teknik şartıdır.

- Her kayıt benzersiz kimlikle tutulacaktır.
- Her işlemi kimin yaptığı kaydedilecektir.
- Kayıt geçmişi korunacaktır.
- Düzenleme ve iptal işlemleri de günlüğe yazılacaktır.
- Fiziksel silme ile geçmiş yok edilmeyecektir.
- Para hesapları kuruş hassasiyetinde yapılacaktır.

### 9. OTOMATİK SENKRONİZASYON

Telefon ve bilgisayar aynı verileri kullanacaktır.

- İnternet varken otomatik senkronizasyon.
- İnternet yokken yerel kayıt.
- Bağlantı geldiğinde bekleyen işlemlerin gönderilmesi.
- Aynı kaydın iki defa eklenmesinin engellenmesi.
- Çakışan değişikliklerin raporlanması.
- Senkronizasyon durumunun ekranda gösterilmesi.

Bir cihazda oluşturulan kayıt diğer cihazda da görünmelidir.

Çakışma olduğunda hiçbir veri sessizce silinmemelidir.

### 10. YEDEKLEME VE GERİ YÜKLEME

- Otomatik bulut yedeklemesi.
- Haftalık yönetici yedeği.
- JSON formatında tam veri yedeği.
- Excel/CSV dışa aktarımı.
- Yedekten geri yükleme.
- Geri yükleme öncesi mevcut verilerin korunması.
- Geri yükleme sonrası kayıt sayısı ve bütünlük kontrolü.

Yedekler şifreli tutulmalıdır.

Senkronizasyon ve yedek birbirinden bağımsız çalışmalıdır.

### 11. TEKNİK YAPI

Önerilen teknoloji:

- PWA: Telefon ve bilgisayarda çalışan uygulama.
- React: Kullanıcı arayüzü.
- IndexedDB: Çevrimdışı yerel kayıt.
- Supabase/PostgreSQL: Ortak bulut veritabanı.
- Güvenli kullanıcı doğrulaması.
- Otomatik senkronizasyon kuyruğu.

Uygulama telefon veya bilgisayara kurulabilir olmalıdır.

### 12. KAPSAM DIŞI

Aşağıdakiler ilk sürümde kesinlikle yapılmayacaktır:

- Resmî muhasebe.
- E-fatura ve e-arşiv.
- SGK ve resmî bordro.
- Ayrıntılı üretim yönetimi.
- CNC ve kesim optimizasyonu.
- Fire hesapları.
- Karmaşık stok maliyeti.
- Otomatik malzeme reçetesi.
- Banka entegrasyonu.
- Çok şube yönetimi.
- Gereksiz grafik ve analiz ekranları.

### 13. KABUL ŞARTLARI

Uygulama tamamlanmış sayılmadan önce:

1. İki ortak kendi hesaplarından giriş yapabilmelidir.
2. Gelir ve gider kaydı oluşturabilmelidir.
3. İki cihazda aynı kasa bakiyesi görülmelidir.
4. Taksitli işler doğru hesaplanmalıdır.
5. Stok adı, birimi ve miktarı kolayca girilebilmelidir.
6. Personel ekleme ve çıkarma çalışmalıdır.
7. İnternetsiz kayıt yapılabilmelidir.
8. İnternet geldiğinde otomatik senkronizasyon tamamlanmalıdır.
9. Aynı paket iki kere işlendiğinde mükerrer kayıt oluşmamalıdır.
10. Hatalı bir işlem düzeltildiğinde geçmiş kaybolmamalıdır.
11. Yedekten geri yükleme test edilmelidir.
12. Veri sayısı ve tutarları iki cihazda birebir eşit olmalıdır.

### 14. KODLAMA İÇİN KAPSAM KİLİDİ

Bu belge yazılım geliştirme sürecinin tek referansıdır.

- Plan dışındaki özellikler eklenmeyecektir.
- Kullanıcı talep etmeden yeni modül oluşturulmayacaktır.
- Mevcut özellikler izinsiz değiştirilmeyecektir.
- Basit işlemler gereksiz yere karmaşıklaştırılmayacaktır.
- İşlem günlüğü, senkronizasyon ve yedekleme hiçbir zaman atlanmayacaktır.
- Her modül tamamlandığında test edilecektir.
- Çalışmayan özellik tamamlanmış gibi sunulmayacaktır.
- Veritabanı değişiklikleri öncesinde yedek alınacaktır.

**NİHAİ AMAÇ:** İki ortağın işletmeye giren parayı, çıkan parayı ve kasada kalan tutarı karıştırmadan takip edebilmesi. Atölye Defteri bu amaca hizmet etmeyen hiçbir gereksiz özelliği barındırmayacaktır.