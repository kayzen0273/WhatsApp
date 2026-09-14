# WA Dashboard — Pairing Code + Browser Inline di Chat

Dasbor web sederhana untuk menyambungkan nomor WhatsApp lewat **pairing code 8 digit**
(tanpa scan QR), lalu menampilkan chat dalam bentuk gelembung. Kalau sebuah pesan
berisi link, gelembungnya punya tombol **"🌐 Buka pratinjau di sini"** yang memunculkan
mini-browser (iframe) langsung di dalam gelembung itu.

## Cara menjalankan

1. Pastikan Node.js versi 18 ke atas terpasang.
2. Masuk ke folder project, lalu install dependensi:
   ```bash
   npm install
   ```
3. Jalankan server:
   ```bash
   npm start
   ```
4. Buka `http://localhost:3000` di browser.
5. Masukkan nomor WhatsApp dengan kode negara, tanpa `+` atau `0` di depan
   (contoh: `62812xxxxxxx`), lalu klik **Minta kode**.
6. Di HP: buka WhatsApp → Setelan → Perangkat tertaut → Tautkan perangkat →
   pilih **"Tautkan dengan nomor telepon"** → masukkan 8 digit kode yang muncul
   di layar dasbor.
7. Setelah tersambung, dasbor otomatis pindah ke tampilan chat.

Sesi login tersimpan di folder `auth_info/` (dibuat otomatis), jadi kamu tidak
perlu pairing ulang setiap kali server di-restart — kecuali kamu logout lewat
tombol ⏻ di sidebar.

## Struktur project

```
wa-dashboard/
├── package.json
├── server.js          # Backend: koneksi WhatsApp (Baileys) + REST API + socket.io
└── public/
    ├── index.html      # Layar pairing + dasbor chat
    ├── style.css        # Tampilan (palet gelap, aksen emas)
    └── app.js           # Logika frontend, termasuk fitur browser inline
```

## Catatan penting

- **Ini bukan API resmi WhatsApp.** Project ini pakai [Baileys](https://github.com/WhiskeySockets/Baileys),
  library open-source yang berkomunikasi dengan WhatsApp Web secara tidak resmi.
  Pakai untuk keperluan pribadi/eksperimen; risiko pemblokiran nomor tetap ada,
  jadi jangan pakai nomor utama untuk uji coba awal.
- **Fitur browser inline punya batas teknis**: banyak situs (misalnya Google,
  Instagram, sebagian besar bank/e-commerce) mengirim header
  `X-Frame-Options` atau `Content-Security-Policy` yang **menolak** ditampilkan
  di dalam iframe. Untuk situs seperti itu, kotak pratinjau akan tampak kosong
  atau blank. Tidak ada cara di sisi frontend untuk memaksa situs lain agar
  bisa di-iframe — itu memang dibuat aman oleh pemilik situs tersebut.
  Solusi umum kalau butuh preview lebih andal: pakai screenshot service
  (mis. render server-side dengan headless browser) alih-alih iframe langsung.
- Penyimpanan chat saat ini hanya di memori (hilang saat server restart).
  Untuk pemakaian jangka panjang, ganti `Map` di `server.js` dengan database
  (SQLite/PostgreSQL/dst).
- Untuk deploy ke server publik, taruh di belakang HTTPS (mis. lewat Nginx +
  Let's Encrypt) dan tambahkan autentikasi ke dasbor ini sendiri — saat ini
  siapa pun yang membuka URL bisa melihat & mengirim chat.

## Kustomisasi cepat

- Warna & font ada di `public/style.css` bagian `:root` (variabel `--accent`,
  `--bubble-out`, dst).
- Untuk mendukung pesan gambar/video/dokumen (bukan cuma teks), perluas fungsi
  `extractText()` dan `messages.upsert` handler di `server.js`.
