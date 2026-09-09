# GLOW'SNAKE

## Struktur Proyek

```
jeysnake-vercel/
├── index.html      <- seluruh game (HTML+CSS+JS jadi satu file)
├── vercel.json      <- konfigurasi ringan untuk Vercel
└── README.md
```

## Note

- Skor tertinggi & preferensi mode perangkat (Mobile/PC) disimpan di `localStorage` browser masing-masing pemain — tidak tersimpan di server, jadi tiap pemain punya skor tertinggi sendiri-sendiri di device mereka.
- Tidak ada dependency, database, atau environment variable yang perlu diatur — murni HTML/CSS/JS statis.
