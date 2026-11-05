# LED Rental Frame Builder

Editor 3D lokal untuk menyusun rangka LED rental secara manual. Dibuat dengan HTML, CSS, JavaScript dan Three.js r170 yang sudah disertakan dalam paket. **Tidak memerlukan internet, akun, instalasi, atau proses build untuk dipakai.**

## Menjalankan

1. Ekstrak ZIP terlebih dahulu jika Anda mengunduh paket ZIP.
2. Klik dua kali **LED-Rental-Frame-Builder.html**. File ini sudah berisi seluruh aplikasi, termasuk pustaka 3D.
3. Alternatif: buka **index.html** atau **BUKA-APLIKASI.cmd**. Untuk versi `index.html`, pertahankan `styles.css` dan `app.bundle.js` di folder yang sama.
4. Gunakan Chrome, Edge, atau Firefox dengan WebGL aktif. Semua proses penyusunan berlangsung di browser perangkat Anda.

Tidak perlu menjalankan server. Jika ingin menggunakan server lokal, dari folder aplikasi jalankan `python -m http.server 8765 --bind 127.0.0.1`, lalu buka `http://127.0.0.1:8765`.

## Alur penggunaan

- Aplikasi dimulai dengan satu contoh frame **1 × 2 m**. Tombol **Baru** mengosongkan proyek.
- Isi **Lebar luar** dan **Tinggi luar** dalam **mm** (contoh: 2000 × 2000), kemudian **Add Frame**. Isi **Jarak hollow tengah** bila ingin menambahkan batang horizontal: 1000 berarti satu batang setiap 1000 mm dari sisi bawah luar ke pusat batang. Nilai 0 berarti tanpa batang tengah. Pengaturan ini juga bisa diubah pada panel properti frame terpilih. Frame baru berada pada X=0, Z=0, dengan sisi bawah di Y=0. Posisi awal frame baru bisa bertumpuk dengan frame sebelumnya; geser sesuai kebutuhan.
- Atau seret kartu **Rectangular frame** ke area kerja dalam tampilan **Iso** atau **Top**. Titik drop menentukan X/Z di lantai. Drag/drop HTML ini ditujukan untuk mouse; pada layar sentuh gunakan Add Frame.
- Pilih frame dengan mengklik batangnya atau namanya di daftar objek. Bagian tengah rangka terbuka dan tidak memiliki permukaan panel.
- **Contoh batang tengah:** tinggi 2000 mm, lebar 2000 mm, jarak 1000 mm menghasilkan **1 batang horizontal di 1000 mm dari bawah**. Tinggi 3000 mm dengan jarak yang sama menghasilkan 2 batang di 1000 dan 2000 mm. Batang yang bertabrakan dengan hollow keliling tidak ditambahkan. Jarak tidak membagi sisi lebar; arah batang selalu horizontal dalam bidang lokal frame.
- **Geser:** seret batang rangka langsung pada bidang sejajar layar. Untuk mengatur kedalaman dan sumbu tertentu, seret panah X/Y/Z atau bidang kecil gizmo. Posisi numerik X/Y/Z selalu mengacu ke koordinat dunia.
- **Putar:** seret cincin gizmo X/Y/Z, gunakan tombol **+90°**, atau isi rotasi derajat. Acuan **sumbu dunia/lokal** berlaku untuk gizmo dan tombol +90°. Input numerik menggunakan rotasi lokal **Euler XYZ**. Nilai Euler bisa berubah bentuk pada orientasi tertentu dengan hasil orientasi yang setara.
- Klik **Letakkan di lantai** agar titik terendah frame berada pada Y=0, termasuk sesudah diputar.
- **Duplikat** menyalin ukuran dan rotasi dengan offset Z sebesar +0,15 m agar dapat dibedakan. Jika melewati batas posisi, offset menjadi −0,15 m. Duplikasi tidak menyusun pola.
- **Hapus**, **Undo**, dan **Redo** tersedia. Riwayat maksimal 80 keadaan mencakup objek, ukuran, posisi, dan rotasi. Mengimpor JSON memulai riwayat baru.

## Kamera dan grid

- Seret area kosong untuk orbit; klik kanan dan seret untuk pan; roda mouse untuk zoom. Pada layar sentuh, gunakan satu jari di area kosong untuk orbit dan dua jari untuk pan/zoom.
- **Front:** melihat dari +Z. **Back:** −Z. **Left:** −X. **Right:** +X. **Top:** +Y, dengan −Z ke atas layar.
- Lima tampilan sisi memakai kamera **orthographic**, sehingga ukuran tidak terdistorsi perspektif. **Iso** memakai kamera perspective.
- **F** atau tombol Fit menampilkan semua frame. Frame boleh digeser melalui atau di bawah lantai karena penempatan sepenuhnya manual.
- **1 unit = 1 meter**. Garis utama grid berjarak 1 m; subdivisi 0,1 m di sekitar titik asal. Grid utama meluas mengikuti susunan, sedangkan subdivisi dibatasi area 40 × 40 m untuk menjaga responsivitas.
- Label dimensi dan garis ukur mengikuti **frame terpilih**, menunjukkan lebar dan tinggi luarnya. Label dapat disembunyikan.

## Ukuran hollow dan snap

- Profil permanen **40 × 40 mm = 0,04 × 0,04 m**. Tidak ada pengaturan ukuran hollow atau pola susunan otomatis.
- Frame baru berada pada bidang lokal XY; ketebalannya searah Z lokal. Objek terdiri dari empat batang keliling dan batang horizontal opsional, tanpa panel solid. Seluruh batang tetap memakai profil 40 × 40 mm dan ikut bergerak/berputar bersama frame. Tampilan batang merepresentasikan selubung luar hollow; ketebalan dinding dalam tidak dimodelkan.
- Ukuran luar frame: **100–50.000 mm** pada setiap sisi. Posisi, grid, label ukuran 3D, dan data lebar/tinggi di JSON tetap menggunakan meter; kolom jarak hollow JSON `braceSpacingMm` memakai mm. JSON lama tanpa kolom ini tetap dapat dimuat dan berarti tanpa batang tengah. Jarak hollow tengah: **0 atau 100–50.000 mm**; maksimal **200 batang tengah per frame** dan **1500 per proyek** untuk menjaga responsivitas. Posisi titik tengah: **−500 sampai +500 m** pada setiap sumbu. Maksimal **300 frame** per proyek.
- **Snap langkah** opsional untuk gerakan/gizmo, dengan langkah posisi 0,01 / 0,05 / 0,1 / 0,25 / 0,5 / 1 m dan rotasi 5 / 15 / 45 / 90 derajat.
- Snap adalah pembulatan langkah, bukan penyambungan otomatis antarframe. Input numerik tetap dapat mengisi nilai presisi saat snap aktif. Aplikasi tidak memeriksa tabrakan atau sambungan.

## Simpan, muat, dan screenshot

- **Simpan JSON** mengunduh proyek: seluruh frame, nama, dimensi, jarak hollow tengah, posisi, rotasi, preferensi snap/grid, dan keadaan kamera. Simpan sebelum menutup halaman; tidak ada penyimpanan otomatis.
- **Muat** membaca file JSON lokal dari aplikasi ini. Format, nilai angka, batas objek, dan profil hollow divalidasi sebelum mengganti proyek. File rusak ditolak tanpa mengubah objek saat ini. Ukuran file maksimal 5 MB.
- **Export PNG** mengunduh tampilan 3D saat ini, termasuk grid dan label dimensi terpilih jika diaktifkan. Gizmo dan panel editor tidak ikut diekspor. PNG mengikuti resolusi viewport dengan rasio piksel perangkat maksimal 2.
- Browser menyimpan file di folder unduhan atau lokasi yang Anda pilih. Izinkan unduhan jika browser menanyakannya.

## Pintasan

| Tombol | Fungsi |
|---|---|
| W | Mode geser |
| E | Mode putar |
| F | Fit semua objek |
| Esc | Batalkan geseran aktif / lepaskan pilihan |
| Ctrl+D | Duplikat frame |
| Delete / Backspace | Hapus frame |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+S | Simpan JSON |

Pintasan pengeditan tidak mengambil alih saat sedang mengetik pada kolom. Pada macOS, Command dapat menggantikan Ctrl.

## Layar kecil

Panel kiri dan kanan berubah menjadi panel buka/tutup melalui **Frame & objek** dan **Properti** di atas area kerja. Panel properti dapat digulir. Untuk penyusunan rumit, mouse dan layar desktop memberi ruang kerja lebih luas.

## File dan pengembangan

- `LED-Rental-Frame-Builder.html`: aplikasi mandiri satu file, bisa dibuka langsung.
- `index.html`, `styles.css`, `app.bundle.js`: versi file terpisah, juga bisa dibuka langsung.
- `src/app.js`: antarmuka, geometri, kamera dan interaksi Three.js.
- `src/project.js`: format proyek dan validasi.
- `tests/project.test.js`: pemeriksaan format proyek, batas dimensi, angka, snap, dan kamera.
- `THREE-LICENSE.txt`: lisensi MIT Three.js.

Jika mengubah sumber, jalankan `npm install` sekali, lalu `npm run build` dari folder ini. Build memperbarui bundle dan HTML mandiri. Pemeriksaan format data dapat dijalankan dengan `npm test` (memerlukan Node.js).

Aplikasi ini menghasilkan ilustrasi geometri dan penempatan manual. Analisis kekuatan struktur, detail las, beban, angkur, serta daftar potong material tidak termasuk.
