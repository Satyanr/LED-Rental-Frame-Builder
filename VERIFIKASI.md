# Pembaruan 1.6 — Impor pemberat, copy/paste, pilihan, dan grup

- Berkas JSON v1.4 yang dilaporkan diperiksa: `frames` berisi 20 frame dan 1 LED, tanpa objek pemberat. Pengaturan `ballastTemplate` tersimpan terpisah dari objek. Aplikasi kini menyebut jumlah pemberat pada hasil simpan/muat dan status bawah, termasuk pesan saat berkas berisi 0 pemberat.
- Pemuatan menyiapkan seluruh objek/geometri sebelum mengganti proyek aktif; data invalid ditolak sebelum perubahan dan kegagalan pembuatan geometri membuang hasil sementara.
- 38 pemeriksaan otomatis lolos. Tambahan pemeriksaan mencakup JSON grup campuran dengan kedua jenis pemberat, penyalinan ID grup/objek, tujuan tali yang menunjuk frame salinan, pelepasan tujuan yang tidak ada, batas penyalinan, dan perbedaan form pemberat dengan objek aktual.
- Browser menguji berkas sintetis 20 frame + 1 LED tanpa pemberat, menambahkan satu jerigen dan satu balok, mengunduh JSON 23 objek, lalu memuatnya ke HTML mandiri offline. Kedua pemberat kembali muncul.
- Ctrl+A/C/V/G/Shift+G/D, Ctrl/Shift+klik, Alt+klik anggota grup, penghapusan pilihan, Undo/Redo, dan penggunaan Ctrl+A di kolom teks lolos. Pilihan 5 objek campuran disalin menjadi 10 objek dengan 4 pemberat; grup salinan mendapat ID baru dan tali menunjuk frame salinan.
- Seret grup langsung di viewport dan melalui gizmo X memindahkan semua anggotanya dengan delta yang sama. Input posisi dan putaran +90° mempertahankan jarak antaranggotanya. Undo/Redo memulihkan hasil transformasi.
- Grup dan kedua pemberat tetap ada setelah simpan/muat ke HTML mandiri. Pilihan dengan sebagian anggota terkunci menonaktifkan transformasi sampai semua kunci dibuka. Copy jerigen ke proyek Baru melepaskan sambungan ke frame yang tidak ada.
- Screenshot desktop dan panel objek pada 390 × 844 diperiksa. Kotak batas pilihan serta daftar anggota terlihat; tidak ada overflow horizontal atau error JavaScript pada pemeriksaan browser.

# Pembaruan 1.5 — Tali pengikat dan kunci frame

- 33 pemeriksaan otomatis lolos. Data tali memvalidasi ID tujuan, jenis frame/hollow, indeks batang, dan posisi 0–100%; sambungan rusak ditolak sebelum mengganti proyek. Status kunci dan tali tetap tersimpan setelah serialisasi JSON; proyek lama mendapat kunci nonaktif.
- Geometri tali diperiksa: berasal dari atas belakang jerigen, melingkari hollow tujuan, serta mengikuti translasi, rotasi, dan perubahan dimensi objek tujuan.
- Chrome headless menguji kunci dengan seret langsung pada batang dan perubahan posisi/rotasi melalui event. Posisi dan rotasi terkunci tetap utuh; membuka kunci memungkinkan seret kembali. Undo/Redo memulihkan status kunci.
- Pemilihan hollow melalui klik viewport berhasil pada frame terkunci dan mempertahankan pilihan jerigen. Pilihan batang tengah, posisi sepanjang batang, pembatalan Esc, lepas tali, serta pindah tujuan ke hollow lurus berhasil.
- Menghapus frame tujuan atau menghilangkan batang tengah tujuan melepas tali tanpa error. Undo mengembalikan objek dan sambungannya.
- JSON hasil unduhan menyimpan posisi tali 90% saat input belum kehilangan fokus. Muat ke HTML mandiri offline memulihkan tali dan kunci. Duplikat jerigen dapat memiliki titik ikat berbeda tanpa mengubah jerigen asal.
- JSON dengan tujuan tali tidak ditemukan ditolak tanpa mengganti objek saat ini. Export PNG menyertakan tali. Screenshot desktop dan panel properti pada 390 × 844 diperiksa; tidak ada overflow horizontal.
- Pemeriksaan browser v1.4 tetap dijalankan untuk penambahan pemberat, LED, hollow, geometri jerigen, drag/drop, simpan/muat, dan HTML mandiri. Contoh proyek pemberat diperbarui dengan frame terkunci dan dua tali ke hollow atas.

# Pembaruan 1.4 — Objek pemberat

- 28 pemeriksaan otomatis lolos, termasuk jenis pemberat, kedalaman custom, validasi data rusak, rekap per jenis/kedalaman, kompatibilitas JSON lama, serta simpan/muat form dan objek campuran.
- Geometri aktual Three.js diperiksa: ukuran luar jerigen (termasuk tali/pegangan) dan balok sesuai lebar/tinggi/kedalaman; bagian terbawah tepat Y=0, juga setelah diputar dan diletakkan kembali di lantai.
- Chrome headless membuka `index.html` dan HTML mandiri langsung melalui `file://` dengan jaringan dinonaktifkan. Kedua pemberat berhasil ditambahkan tanpa error JavaScript atau permintaan HTTP/HTTPS.
- Interaksi browser lolos: pilih/seret jerigen langsung di viewport, ubah kedalaman, tolak kedalaman 0, duplikat, hapus, Undo/Redo, putar, letakkan di lantai, dan drag/drop kartu pemberat. Penambahan LED Screen serta hollow lurus tetap berjalan.
- File JSON hasil unduhan aktual diperiksa: kedalaman 333 mm yang masih aktif diketik tersimpan sebagai `depth: 0.333`; empat pemberat, rotasi, jenis tab, dan ukuran form balok 800 × 350 × 400 mm tersimpan. Muat kembali ke halaman baru memulihkan nilainya.
- Export PNG menghasilkan file PNG valid. Screenshot jerigen, gabungan objek, dan panel Pemberat pada 390 × 844 diperiksa secara visual; tidak ada overflow horizontal.
- Build akhir memperbarui bundle dan HTML mandiri. `contoh-frame-dan-pemberat.json` berisi satu frame, dua jerigen bertali, dan dua balok semen. Paket ZIP v1.4 menyertakan versi terbaru beserta sumbernya.

# Pembaruan 1.3 — Bentuk frame dan LED Screen

- 23 pemeriksaan otomatis lolos. Tambahan pemeriksaan mencakup frame kotak/persegi panjang, geometri hollow lurus 40 × 40 mm, preset dan ukuran LED custom, bezel 2 mm, batas dua kabinet berdampingan, rekap material terpisah, data tidak valid, dan simpan/muat proyek campuran.
- JSON versi lama tanpa jenis objek atau pengaturan LED tetap dimuat sebagai frame; template LED mendapat nilai awal 1000 × 500 mm.
- Build memperbarui `app.bundle.js` dan HTML mandiri offline. Sintaks JavaScript dan struktur HTML diperiksa secara otomatis.
- Verifikasi visual dan interaksi browser untuk versi 1.3 belum dapat diselesaikan: alat Computer Use menghentikan akses karena URL jendela Chrome tidak dapat dipastikan. Catatan verifikasi browser di bagian versi sebelumnya hanya berlaku untuk versi tersebut.

# Pembaruan 1.2 — Persistensi JSON dan rekap

- File JSON hasil unduhan aktual diperiksa: objek menyimpan `braceSpacingMm: 500`, sedangkan form Buat frame menyimpan jarak 750 mm, lebar 2000 mm dan tinggi 3000 mm.
- File hasil unduhan itu dimuat ke halaman editor baru. Jarak objek 500 mm dan form 750 mm dipulihkan; batang tengah kembali tampil.
- Penyimpanan diuji ketika input belum memicu perubahan melalui perpindahan fokus.
- Rekap di browser: 20 frame 2 × 2 m, 10 frame 2 × 1 m, total 30 pcs.
- Duplikat menjadi 31 pcs, hapus kembali 30 pcs. Mengubah satu frame 2 × 2 menjadi 1 × 2 mengubah kelompok menjadi 19 dan 11 pcs. Undo mengembalikan 20 dan 10 pcs.
- Panel rekap diperiksa pada viewport 390 × 844: tetap di dalam layar, tanpa overflow horizontal.
- 15 pemeriksaan otomatis lolos, termasuk simpan/muat form, kompatibilitas JSON lama, pengelompokan ukuran dan total objek.

# Pembaruan 1.1 — Hollow tengah

- Input lebar, tinggi, dan jarak hollow tengah memakai mm; koordinat dan grid tetap meter.
- Contoh 2000 × 2000 mm dengan jarak 1000 mm ditampilkan di browser sebagai satu batang horizontal di tengah.
- Mengubah tinggi menjadi 3000 mm menghasilkan dua batang pada 1000 dan 2000 mm.
- Nilai 0 menghapus batang tengah; Undo mengembalikannya.
- Duplikasi mempertahankan jarak dan jumlah batang tengah.
- Contoh JSON dengan jarak 1000 mm dimuat ulang di browser: ukuran 2000 × 2000 mm dan satu batang tengah dipulihkan tanpa error.
- 11 pemeriksaan otomatis lolos, termasuk geometri batang, batas dalam frame, penyimpanan data baru, dan pemuatan JSON lama.

# Catatan verifikasi

Versi 1.0 · 5 November 2026.

Pemeriksaan dilakukan pada aplikasi aktual melalui browser dan server lokal, menggunakan versi file terpisah serta HTML mandiri.

| Pemeriksaan | Hasil |
|---|---|
| Membuka editor dan menampilkan frame 1 × 2 m | Berhasil |
| Add Frame berukuran 2 × 1,5 m | Berhasil |
| Menggeser batang langsung pada bidang kamera | X/Y/Z berubah sesuai arah drag |
| Gizmo translasi sumbu X dengan snap 0,1 m | X menjadi 0,5 m; Y/Z tetap |
| Drag langsung dengan snap 0,1 m | Koordinat terbaca 0,3 / 0,9 / 0,2 m |
| Drag/drop kartu frame ke lantai | Frame kedua muncul; Y titik tengah = 1 m untuk tinggi 2 m |
| Input numerik melalui keyboard | Posisi X 1,25 m, lebar 2,5 m, rotasi Y 30° tersimpan pada objek |
| Tombol rotasi +90° | Orientasi dan nilai properti berubah |
| Duplikat, hapus, Undo | Jumlah dan objek terpilih kembali sesuai operasi |
| Front / Back / Left / Right / Top / Iso | Kamera berubah; tampilan sisi orthographic |
| Simpan JSON | File aktual terunduh dan isinya diperiksa |
| Muat kembali JSON empat frame | Empat frame, properti, preferensi dan kamera berhasil dimuat |
| Impor proyek hollow bukan 40 × 40 mm | Ditolak; empat objek saat ini tetap utuh |
| Export PNG | File aktual terunduh, dibuka dan diperiksa; gizmo tidak ikut |
| Viewport 390 × 844 | Panel properti bisa dibuka/tutup; tidak ada overflow horizontal |
| HTML mandiri setelah build akhir | Editor tampil dan tidak mencatat error browser |
| Pemeriksaan otomatis format data | 7 pemeriksaan lolos |

HTML mandiri berisi seluruh CSS dan pustaka JavaScript; tidak menggunakan import modul, CDN, font web, maupun permintaan jaringan aplikasi. Pembukaan melalui protokol file langsung tidak dapat diuji otomatis karena kebijakan alat pratinjau hanya mengizinkan HTTP/HTTPS. Pemeriksaan browser untuk HTML mandiri dilakukan melalui server lokal.

Pemeriksaan layar kecil dilakukan dengan ukuran viewport yang disimulasikan; perangkat sentuh fisik dan seluruh model GPU/browser belum diuji. Batas 300 frame adalah batas aplikasi; pengujian ini tidak mengukur performa maksimum 300 frame pada perangkat Anda.
