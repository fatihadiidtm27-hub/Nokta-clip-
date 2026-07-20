# NOKTA // CLIP — Mobile Edit Console

Aplikasi edit video mobile bertema HUD futuristik. Dibangun sebagai **PWA (Progressive Web App)** — bisa di-"Install" dari Chrome Android sehingga muncul ikon di home screen dan berjalan fullscreen seperti aplikasi native, tanpa proses upload ke server (semua diproses di perangkat).

> **Catatan jujur soal batasan teknis:** ini bukan aplikasi Android native (APK/Play Store) — itu perlu Android Studio/Kotlin. ini adalah web app yang bisa "diinstal", dan menjalankan sebagian besar fitur editing sepenuhnya di browser.

## Fitur

| Fitur | Cara kerja | Batasan |
|---|---|---|
| **Trim In/Out** | Drag gagang cyan (in) / violet (out) di timeline, atau tombol Mark In/Out | — |
| **Auto Hook** | Template teks hook siap pakai, muncul animasi pop di awal klip | Teks dari daftar preset, bukan digenerate AI |
| **Teks bergaya CapCut** | 6 font tebal (Anton, Bebas Neue, Poppins Black, dll), warna, drag posisi | — |
| **Analisa Momen Menarik** | Heuristik: puncak volume audio + perubahan gerakan visual antar frame + kata kunci pada subtitle | **Bukan** prediksi viral AI — murni estimasi teknis berbasis sinyal audio/visual/teks |
| **Subtitle Otomatis** | Auto-timing berdasar deteksi jeda hening → slot waktu otomatis, teks diisi manual. Ada opsi eksperimental pengenalan suara via mic | Tidak ada transkripsi otomatis akurat tanpa layanan cloud (Whisper/Google Speech); mode mic bersifat eksperimental & butuh lingkungan tenang |
| **Thumbnail Editor** | Ambil beberapa frame dari klip, pilih satu, tambah teks, crop rasio (9:16/1:1/16:9), atur brightness/contrast, ekspor PNG | — |
| **Export** | Merender ke `.webm` dengan teks & subtitle di-burn-in langsung ke video | Format WebM (bukan MP4) — dukungan native dari `MediaRecorder` browser |

## Cara pakai

1. Buka aplikasi di **Chrome Android** (disarankan — butuh `MediaRecorder`, `captureStream`, dan Web Audio API).
2. Ketuk menu **⋮ → Add to Home screen** atau tombol **Install** di pojok kanan atas untuk pengalaman seperti aplikasi.
3. Impor video, atur trim, tambahkan hook/teks, jalankan analisis momen menarik, isi subtitle, buat thumbnail.
4. Render dan unduh hasilnya dari tab **Ekspor**.

## Menjalankan secara lokal

```bash
python3 -m http.server 8000
# atau
npx serve .
```

Buka `http://localhost:8000` dari HP (device di jaringan yang sama) atau via Chrome DevTools device emulation di desktop.

## Deploy ke GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit: NOKTA Clip mobile PWA"
git branch -M main
git remote add origin https://github.com/<username>/<nama-repo>.git
git push -u origin main
```

Lalu di GitHub: **Settings → Pages** → Source: branch `main`, folder `/ (root)`. Situs aktif di `https://<username>.github.io/<nama-repo>/`.

**Penting untuk PWA:** `service worker` (`sw.js`) hanya berfungsi penuh di koneksi HTTPS — GitHub Pages sudah otomatis HTTPS, jadi aman.

## Struktur proyek

```
nokta-clip-android/
├── index.html      → struktur UI mobile (tab-based)
├── style.css        → tema HUD hitam-biru
├── core.js          → import, trim, waveform, playback, export compositor
├── texttool.js      → hook & teks overlay (drag, font, warna)
├── viral.js         → analisis momen menarik (audio + visual + kata kunci)
├── subtitle.js       → auto-timing subtitle + burn-in + mic eksperimental
├── thumbnail.js      → ekstraksi frame + editor thumbnail
├── main.js           → navigasi tab + install prompt PWA + service worker
├── manifest.json     → konfigurasi PWA
├── sw.js             → service worker (cache offline)
├── icons/            → ikon aplikasi
├── README.md
├── LICENSE
└── .gitignore
```

## Kompatibilitas

- **Terbaik di:** Chrome / Edge Android & desktop (semua fitur berfungsi).
- **Safari/iOS:** dukungan `captureStream`/`MediaRecorder` terbatas — ekspor mungkin tidak berjalan.
- Pengenalan suara (`SpeechRecognition`) hanya tersedia di browser berbasis Chromium.

## Lisensi

MIT — lihat [LICENSE](./LICENSE). Kalau berencana menjual aplikasi ini, pertimbangkan mengganti lisensi jadi proprietary/EULA dan mengontrol distribusinya (repo private, hosting dengan akses terbatas).
