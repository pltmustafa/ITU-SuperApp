# İTÜ SuperApp

![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-lightgrey)
![React Native](https://img.shields.io/badge/Framework-React%20Native-61DAFB?logo=react&logoColor=white)
![State Management](https://img.shields.io/badge/State-Zustand-orange)

Resmi İTÜ Mobil uygulamasının ağır çalışmasından dolayı, başta kişisel kullanım için yaptığım daha sonra herkese açmaya karar verdiğim açık kaynaklı bir ITU Mobil istemcisi.

## 📱 Ekran Görüntüleri


### Dashboard
<p align="center">
  <img src="screenshots/dashboard_1.png" width="200" style="margin-right: 10px;" />
  <img src="screenshots/dashboard_2.png" width="200" style="margin-right: 10px;" />
</p>

### OBS
<p align="center">
   <img src="screenshots/obs_1.png" width="200" style="margin-right: 10px;" />
   <img src="screenshots/obs_2.png" width="200" style="margin-right: 10px;" />
   <img src="screenshots/obs_3.png" width="200" style="margin-right: 10px;" />
   <img src="screenshots/obs_4.png" width="200" />
</p>

### Ninova
<p align="center">
  <img src="screenshots/ninova_1.png" width="200" style="margin-right: 10px;" />
  <img src="screenshots/ninova_2.png" width="200" style="margin-right: 10px;" />
  <img src="screenshots/ninova_3.png" width="200" style="margin-right: 10px;" />
</p>

### Bildirimler
<p align="center">
  <img src="screenshots/notification_1.png" width="200" style="margin-right: 10px;" />
  <img src="screenshots/notification_2.png" width="200" style="margin-right: 10px;" />
  <img src="screenshots/notification_3.png" width="200" style="margin-right: 10px;" />
  <img src="screenshots/notification_4.png" width="200" />
</p>

### Mail
<p align="center">
  <img src="screenshots/mail_1.png" width="200" style="margin-right: 10px;" />
  <img src="screenshots/mail_2.png" width="200" />
</p>

### Ring
<p align="center">
  <img src="screenshots/ring_1.png" width="200" style="margin-right: 10px;" />
  <img src="screenshots/ring_2.png" width="200" />
</p>

### Not Dağılımı
<p align="center">
  <img src="screenshots/dagılım_1.png" width="200" style="margin-right: 10px;" />
  <img src="screenshots/dagılım_2.png" width="200" />
</p>

### GPA Simülatörü
<p align="center">
  <img src="screenshots/gpa.png" width="200" />
</p>

### Önşart Diyagramı
<p align="center">
  <img src="screenshots/önşart.png" width="200" />
</p>

### Notlar
<p align="center">
  <img src="screenshots/notes.png" width="200" />
</p>

### Hakkında
<p align="center">
  <img src="screenshots/hakkında.png" width="200" />
</p>

## ✨ Özellikler

- **Dashboard:** Yemek menüsü, yaklaşan dersler, final takvimi, ders programı, bakiye, devamsızlık.
- **Ninova:** Ders duyuruları, ödevler, ders notları, sınavlar.
- **OBS:** Notlar, harf notları devamsızlıklar.
- **Bildirimler:** İTU Mobil bildirimleri, Sınıf bildirimleri.
- **Ring:** Canlı ring takibi, ring saatleri.
- **Ekstralar:**
  - **GPA Simülatörü:** Gpa simülatörü
  - **Önşart Diyagramı:** Önşart diyagramı
  - **Boş Sınıflar:** Anlık boş sınıflar.
  - **İTÜ Mail:** ITU Mail.
  - **Not Dağılımı:** Geçmiş not dağılımları.
  - **Ders Notları:** Notkutusu/kovan notları.

## 📁 Proje Yapısı

```text
İTÜ SuperApp/
├── App.js                     # Uygulama ana giriş noktası ve Navigation kurulumu
├── assets/                    # İkonlar, resimler ve fontlar
├── components/                # UI bileşenleri
├── constants/                 # Tema renkleri ve sabit değerler
├── screens/                   # Uygulama ekranları
│   ├── about/                 # Hakkında sayfası
│   ├── attendance/            # Devamsızlık ekranları
│   ├── course/                # Ders kayıt ve dönem bilgileri
│   ├── dashboard/             # Ana sayfa (Dashboard)
│   ├── gpa/                   # GPA Simülatörü
│   ├── grades/                # Not dağılımı ve detayları
│   ├── graduation/            # Mezuniyet verileri
│   ├── mail/                  # İTÜ Mail entegrasyonu
│   ├── menu/                  # Genel menü
│   ├── ninova/                # Ninova içerikleri (Dosyalar, duyurular, ödevler)
│   ├── notes/                 # İndirilen ders notları görüntüleyicisi
│   ├── notification/          # Bildirim ekranları ve detayları
│   ├── prerequisites/         # Önşartlı ders ağacı
│   ├── ring/                  # Ring sefer saatleri
│   ├── rooms/                 # Boş sınıflar
│   └── schedule/              # Ders ve final takvimi
├── services/                  # Backend API bağlantıları (OBS, Ninova, İTÜ, Mail)
└── store/                     # Global State Yönetimi (Zustand - useObsStore.js)
```

---
Mustafa Polat