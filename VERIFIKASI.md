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
