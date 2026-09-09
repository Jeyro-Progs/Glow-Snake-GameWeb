# JEY'SNAKE

Game Snake buatan Jeyro-Progs (Jeykhan Ramadhan), siap di-deploy ke Vercel.

## Struktur Proyek

```
jeysnake-vercel/
├── index.html      <- seluruh game (HTML+CSS+JS jadi satu file)
├── vercel.json      <- konfigurasi ringan untuk Vercel
└── README.md
```

Karena game ini murni file HTML statis (tanpa backend/build step), Vercel akan otomatis mendeteksinya sebagai **static site** — tidak perlu framework apa pun.

## Cara Deploy

### Opsi 1: Lewat Vercel CLI (paling cepat)

1. Install Vercel CLI (kalau belum ada), buka terminal di dalam folder `jeysnake-vercel`:
   ```bash
   npm install -g vercel
   ```
2. Login ke akun Vercel:
   ```bash
   vercel login
   ```
3. Jalankan deploy dari dalam folder ini:
   ```bash
   vercel
   ```
   Ikuti pertanyaan yang muncul (pilih scope/akun, nama project, dsb). Cukup tekan Enter untuk pakai default di sebagian besar pertanyaan.
4. Setelah selesai, Vercel akan kasih link preview (misalnya `https://jeysnake-xxxx.vercel.app`).
5. Kalau sudah puas dan mau jadikan live/production:
   ```bash
   vercel --prod
   ```

### Opsi 2: Lewat GitHub + Dashboard Vercel

1. Buat repository baru di GitHub, lalu upload/push folder ini (`index.html`, `vercel.json`, `README.md`) ke repo tersebut.
2. Buka [vercel.com](https://vercel.com), login/daftar (bisa pakai akun GitHub).
3. Klik **"Add New" → "Project"**, lalu pilih repository yang barusan dibuat.
4. Di bagian **Framework Preset**, pilih **"Other"** (karena ini cuma HTML statis, tidak perlu build command apa pun — biarkan Build Command & Output Directory kosong/default).
5. Klik **Deploy**. Tunggu beberapa detik, dan game akan langsung online dengan URL `https://nama-project-kamu.vercel.app`.

### Opsi 3: Drag & Drop (paling gampang, tanpa akun GitHub)

1. Buka [vercel.com/new](https://vercel.com/new).
2. Cari opsi untuk **drag-and-drop folder/deploy tanpa Git** (biasanya ada tombol "Deploy" yang menerima folder langsung).
3. Seret folder `jeysnake-vercel` (yang berisi `index.html`) ke situ.
4. Tunggu proses upload & deploy selesai, lalu game sudah bisa diakses online.

## Catatan

- Skor tertinggi & preferensi mode perangkat (Mobile/PC) disimpan di `localStorage` browser masing-masing pemain — tidak tersimpan di server, jadi tiap pemain punya skor tertinggi sendiri-sendiri di device mereka.
- Tidak ada dependency, database, atau environment variable yang perlu diatur — murni HTML/CSS/JS statis.
