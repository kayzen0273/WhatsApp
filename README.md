# WA Dashboard — QR/Pairing + Command Bot + Browser & HTML Inline di Chat

Dasbor web untuk menyambungkan nomor WhatsApp lewat **QR code** atau
**pairing code 8 digit**, lalu menampilkan chat dalam bentuk gelembung.
Nomor yang tersambung otomatis jadi bot: kirim command seperti `.ping`,
`.rvo`, atau `.html` dan bot akan membalas otomatis. Kalau sebuah pesan
berisi link, gelembungnya punya tombol **"🌐 Buka pratinjau di sini"**;
kalau berisi hasil `.html`, HTML-nya dirender **hidup dan asli** (bukan
screenshot) langsung di dalam gelembung.

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
5. Pilih salah satu cara menyambungkan nomor:
   - **Kode pairing**: masukkan nomor dengan kode negara tanpa `+`/`0`
     (contoh `62812xxxxxxx`) → klik **Minta kode** → di HP: WhatsApp →
     Perangkat tertaut → Tautkan dengan nomor telepon → masukkan 8 digit
     kodenya.
   - **Pindai QR**: klik tab "Pindai QR" → klik **Mulai · Tampilkan QR** →
     di HP: WhatsApp → Perangkat tertaut → Tautkan perangkat → pindai QR
     di layar.
6. Setelah tersambung, dasbor otomatis pindah ke tampilan chat.

Sesi login tersimpan di folder `auth_info/` (dibuat otomatis), jadi kamu tidak
perlu login ulang setiap kali server di-restart — kecuali kamu logout lewat
tombol ⏻ di sidebar.

## Command bot (auto-reply)

Begitu nomor tersambung, setiap chat yang masuk dicek terhadap daftar
command di `lib/commands/`. Command bawaan:

| Command | Fungsi |
|---|---|
| `.ping` | Cek bot masih aktif |
| `.rvo` | Reply ke media "Lihat sekali" untuk membukanya lagi |
| `.html <kode>` | Kirim kode HTML — dirender **hidup** di dashboard |
| `.menu` | Tampilkan daftar command |

**Tambah command baru**: buat file di `lib/commands/`, misal `contoh.js`:
```js
module.exports = {
  prefix: '.contoh',
  description: 'Deskripsi singkat',
  async run({ sock, from, msg, text }) {
    await sock.sendMessage(from, { text: 'Balasan otomatis' }, { quoted: msg });
    return { text: '[bot] Menjalankan .contoh' }; // opsional, muncul di dashboard
  },
};
```
Lalu daftarkan di `lib/commands/index.js`.

## Tentang ".html" — kenapa bukan screenshot?

WhatsApp (aplikasi asli di HP) **tidak bisa** merender HTML/CSS hidup di
dalam chat — itu batasan platform WhatsApp sendiri, bukan sesuatu yang
bisa disiasati dari sisi bot. Jadi:
- **Ke WhatsApp**: bot membalas kode HTML apa adanya sebagai teks/kode.
- **Ke dashboard ini**: kode yang sama dirender **hidup dan asli** lewat
  `<iframe sandbox="allow-same-origin">` di dalam gelembung — markup & CSS
  tetap tampil hidup, tapi JavaScript dari kode yang dikirim diblokir demi
  keamanan (mencegah orang mengirim `.html` berisi script berbahaya).

## Struktur project

```
wa-dashboard/
├── package.json
├── server.js            # Backend: koneksi WhatsApp (Baileys), QR/pairing, REST API, socket.io
├── lib/
│   ├── print.js          # Semua output terminal: banner, log berwarna, kode pairing
│   └── commands/         # Satu file = satu command auto-reply
│       ├── index.js
│       ├── ping.js
│       ├── rvo.js
│       ├── html.js
│       └── menu.js
└── public/
    ├── index.html        # Layar sambungkan (QR/pairing) + dasbor chat
    ├── style.css          # Tampilan (palet gelap, aksen emas)
    └── app.js             # Logika frontend: chat, browser inline, render HTML hidup
```

## Catatan penting

- **Ini bukan API resmi WhatsApp.** Project ini pakai [Baileys](https://github.com/WhiskeySockets/Baileys),
  library open-source yang berkomunikasi dengan WhatsApp Web secara tidak resmi.
  Pakai untuk keperluan pribadi/eksperimen; risiko pemblokiran nomor tetap ada,
  jadi jangan pakai nomor utama untuk uji coba awal.
- **Fitur browser inline (preview link) punya batas teknis**: banyak situs
  (misalnya Google, Instagram, sebagian besar bank/e-commerce) mengirim
  header `X-Frame-Options`/`Content-Security-Policy` yang menolak
  ditampilkan di iframe — kotak pratinjaunya akan tampak kosong. Ini beda
  dengan render `.html`, yang selalu berhasil karena HTML-nya kita buat
  sendiri (bukan memuat situs orang lain).
- Penyimpanan chat saat ini hanya di memori (hilang saat server restart).
  Untuk pemakaian jangka panjang, ganti `Map` di `server.js` dengan database
  (SQLite/PostgreSQL/dst).
- Untuk deploy ke server publik, taruh di belakang HTTPS (mis. lewat Nginx +
  Let's Encrypt) dan tambahkan autentikasi ke dasbor ini sendiri — saat ini
  siapa pun yang membuka URL bisa melihat & mengirim chat, dan bisa memicu
  command bot.

## Kustomisasi cepat

- Warna & font ada di `public/style.css` bagian `:root` (variabel `--accent`,
  `--bubble-out`, dst).
- Untuk mendukung pesan gambar/video/dokumen (bukan cuma teks), perluas fungsi
  `extractText()` dan `messages.upsert` handler di `server.js`.
