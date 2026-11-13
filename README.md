# Contruction Builder (LED Rental)

Versi **1.6.0** — pilih beberapa objek, shortcut copy/paste dan select all, grup, serta jumlah pemberat pada hasil simpan/muat JSON.

Editor 3D lokal untuk menyusun rangka, kabinet LED rental, dan objek pemberat secara manual. Dibuat dengan HTML, CSS, JavaScript dan Three.js r170 yang sudah disertakan dalam paket. **Tidak memerlukan internet, akun, instalasi, atau proses build untuk dipakai.**

## Menjalankan

1. Ekstrak ZIP terlebih dahulu jika Anda mengunduh paket ZIP.
2. Klik dua kali **Contruction-Builder-LED-Rental.html**. File ini sudah berisi seluruh aplikasi, termasuk pustaka 3D.
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

## Pilihan bentuk frame dan LED Screen

- Tab **Frame** menyediakan pilihan bentuk **Kotak**, **Persegi panjang**, dan **Hollow lurus**. Pada Kotak, lebar dan tinggi form saling mengikuti. Persegi panjang memakai lebar dan tinggi terpisah; isi jarak hollow tengah 0 jika hanya ingin keliling terbuka tanpa batang tengah.
- **Hollow lurus** adalah satu batang dengan penampang tetap 40 × 40 mm. Isi panjangnya dalam mm; arah awal mengikuti Y lokal. Putar X/Z untuk membuat batang horizontal. Hollow lurus tidak memiliki batang tengah.
- Tab **LED Screen** membuat **satu objek untuk satu kabinet** videotron. Pilih preset **1000 × 500 mm**, **500 × 500 mm**, atau **Custom**. Lebar dan tinggi selalu dapat diketik langsung; ukuran lain otomatis ditandai Custom.
- Ukuran kabinet yang sudah ditambahkan bisa diubah melalui **Properti LED Screen**, memakai preset atau kolom lebar/tinggi. Badan kabinet dimodelkan setebal 80 mm. Bezel tetap **2 mm pada tiap sisi** mengelilingi permukaan LED di depan dan belakang; dua kabinet berdampingan memiliki total batas 4 mm, tanpa mengubah ukuran luar lebar/tinggi kabinet.
- Frame, hollow lurus, dan kabinet LED semuanya mendukung pilihan dari daftar atau viewport, drag/drop kartu, geser, putar, letakkan di lantai, duplikat, hapus, Undo/Redo, dan ekspor PNG.
- Posisi awal objek baru tetap di titik asal dengan sisi bawah di lantai. Geser kabinet secara manual untuk menyusun videotron; tidak ada pembagian kabinet atau penyusunan otomatis.
- Tab aktif, pilihan bentuk, ukuran kabinet pada form, dan seluruh jenis objek ikut disimpan dalam JSON v1.6. JSON dari versi sebelumnya tetap bisa dimuat; objek lama dibaca sebagai frame.
- Batas proyek **300 objek** berlaku untuk gabungan frame, hollow lurus, LED Screen, dan pemberat. Batas ukuran frame/kabinet serta panjang hollow tetap 100–50.000 mm.
- Untuk mencoba susunan, klik **Muat** dan pilih `contoh-frame-dan-led-screen.json`: berisi frame kotak dengan delapan kabinet 1000 × 500 mm yang saling berdampingan, frame persegi panjang, hollow lurus, dan satu kabinet custom 1280 × 720 mm.

## Objek pemberat

- Buka tab **Pemberat**, pilih **Jerigen air bertali** atau **Balok semen**, lalu klik **Tambah Pemberat** atau seret kartunya ke lantai dalam tampilan Iso/Top.
- Jerigen memiliki badan biru, pegangan terbuka, tutup, serta tali yang melingkari badan dan terikat di pegangan. Balok semen memiliki bentuk padat dengan tekstur beton.
- Ukuran awal jerigen **350 × 500 × 250 mm** dan balok **600 × 300 × 300 mm**, dalam urutan **lebar × tinggi × kedalaman**. Nilai ini adalah ukuran contoh yang dapat disesuaikan. Mengganti jenis mengisi ulang ukuran awal.
- Ubah ketiga ukuran pada form atau panel **Properti pemberat**; batas tiap dimensi 100–50.000 mm. Ukuran luar model jerigen mencakup pegangan dan tali. Posisi awal sisi terbawah berada di lantai, Y=0.
- Semua pemberat mendukung pilih melalui viewport/daftar, seret langsung, gizmo geser/putar, input posisi/rotasi, letakkan di lantai, duplikat, hapus, Undo/Redo, dan ekspor PNG.
- **Material terpakai** membedakan jerigen dan balok, termasuk kedalamannya. Jumlah pemberat ikut batas gabungan 300 objek. Rotasi tidak mengubah kelompok material.
- JSON v1.4 menyimpan `type: "ballast"`, `ballastKind`, `depth` (meter), ukuran, posisi, dan rotasi. Pilihan jenis serta ukuran form disimpan dalam `ballastTemplate`. JSON lama tetap dapat dimuat; versi aplikasi lama belum mendukung objek pemberat.
- Muat **contoh-frame-dan-pemberat.json** untuk mencoba frame terkunci dengan dua jerigen yang diikat ke hollow atas dan dua balok semen.

## Mengikat jerigen ke hollow

1. Pilih jerigen. Pada **Properti pemberat**, bagian **Tali pengikat jerigen** berada di bawah sakelar kunci.
2. Klik **Pilih hollow di area 3D**, lalu klik batang hollow tujuan. Jerigen tetap terpilih; tali berasal dari bagian atas belakang jerigen dan melingkari hollow tujuan. **Esc** atau **Batal** membatalkan pemilihan.
3. Alternatif: pilih **Frame / hollow tujuan** dan **Batang tempat ikat** dari daftar. Frame menyediakan hollow atas, bawah, kiri, kanan, serta batang tengah yang tersedia. Hollow lurus juga dapat menjadi tujuan. Frame terkunci tetap dapat dipilih sebagai tujuan tali.
4. Atur **Posisi sepanjang batang** dari 0–100%: kiri ke kanan untuk batang horizontal, bawah ke atas untuk batang vertikal, menurut sumbu lokal objek.
5. Tali mengikuti posisi dan rotasi jerigen maupun hollow tujuan. Mengubah dimensi frame memperbarui titik ikat. **Lepaskan tali dari hollow** menghapus sambungan tanpa menghapus jerigen.

Satu jerigen memiliki satu tali pengikat ke hollow. Tali ditampilkan sebagai garis tegang, dengan lilitan pada batang tujuan; tali tidak dihitung sebagai objek tambahan. Menghapus objek tujuan atau menghilangkan batang tujuan akan melepas tali. Undo mengembalikan sambungan. Duplikat jerigen mempertahankan tujuan yang sama, dengan titik ikat yang bisa diedit secara terpisah.

## Mengunci frame

- Pilih frame, lalu aktifkan **Kunci posisi & rotasi** pada panel properti. Fitur yang sama juga tersedia untuk hollow, LED, dan pemberat.
- Objek terkunci ditandai ikon gembok pada daftar. Seret langsung, gizmo, input posisi/rotasi, tombol +90°, dan Letakkan di lantai dinonaktifkan sampai kunci dibuka.
- Objek tetap bisa dipilih, diganti namanya, diubah ukurannya, diduplikat, dan dihapus. Hasil duplikasi selalu terbuka kuncinya agar dapat ditempatkan.
- Status kunci dan sambungan tali ikut Undo/Redo serta simpan/muat JSON v1.5. JSON lama dibaca dengan kunci nonaktif dan tanpa tali pengikat tambahan.

## Pilih beberapa, copy/paste, dan grup

- **Ctrl/Shift+klik** pada objek di viewport atau daftar untuk menambah/melepas pilihan. **Ctrl+A** atau tombol **Pilih semua** memilih seluruh objek, termasuk pemberat dan objek terkunci.
- **Ctrl+C** menyimpan pilihan untuk disalin; **Ctrl+V** menempel salinannya dengan offset Z +150 mm. Paste berikutnya memakai +300 mm, +450 mm, dan seterusnya. Copy/Paste bekerja dalam sesi editor yang sama, termasuk setelah membuat proyek Baru. Posisi, ukuran, rotasi, jenis pemberat, dan kedalaman ikut disalin. Salinan terbuka kuncinya.
- **Ctrl+G / Group** menjadikan pilihan satu grup. Klik salah satu anggota untuk memilih seluruh grup. **Alt+klik** memilih satu anggota untuk mengubah nama, ukuran, tali, atau kuncinya.
- **Ctrl+Shift+G / Ungroup** melepas grup dan mempertahankan posisi objek. **Ctrl+D**, **Delete**, dan Undo/Redo juga berlaku pada seluruh pilihan.
- Geser melalui objek atau gizmo untuk memindahkan pilihan bersama. Posisi numerik mengacu ke pusat pilihan; putaran dilakukan terhadap pusat tersebut dan mempertahankan jarak antaranggotanya. Kotak garis hijau menandai batas pilihan. Letakkan di lantai memindahkan pilihan sampai sisi terbawahnya berada di Y=0.
- Jika ada anggota terkunci, buka semua kunci pilihan untuk menggeser/memutar bersama. Sakelar kunci pada pilihan beberapa objek dapat menyamakan status seluruh anggota.
- Menyalin jerigen bersama frame tujuannya mengarahkan tali ke frame salinan. Menyalin jerigen saja mempertahankan tujuan yang masih ada dalam proyek; saat ditempel ke proyek kosong, sambungan ke tujuan lama dilepas.
- Keanggotaan grup tersimpan di JSON v1.6. Muat **contoh-group-dan-pemberat.json**, klik salah satu anggota, lalu coba geser, putar, copy/paste, dan Ungroup.

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
- Ukuran luar frame: **100–50.000 mm** pada setiap sisi. Posisi, grid, label ukuran 3D, dan data lebar/tinggi di JSON tetap menggunakan meter; kolom jarak hollow JSON `braceSpacingMm` memakai mm. JSON lama tanpa kolom ini tetap dapat dimuat dan berarti tanpa batang tengah. Jarak hollow tengah: **0 atau 100–50.000 mm**; maksimal **200 batang tengah per frame** dan **1500 per proyek** untuk menjaga responsivitas. Posisi titik tengah: **−500 sampai +500 m** pada setiap sumbu. Maksimal **300 objek** per proyek.
- **Snap langkah** opsional untuk gerakan/gizmo, dengan langkah posisi 0,01 / 0,05 / 0,1 / 0,25 / 0,5 / 1 m dan rotasi 5 / 15 / 45 / 90 derajat.
- Snap adalah pembulatan langkah, bukan penyambungan otomatis antarframe. Input numerik tetap dapat mengisi nilai presisi saat snap aktif. Aplikasi tidak memeriksa tabrakan atau sambungan.

## Simpan, muat, dan screenshot

- **Simpan JSON** membaca perubahan properti yang sedang diketik sebelum membuat file, termasuk kedalaman pemberat dan posisi ikat tali. Nilai pada form pembuatan objek ikut tersimpan dan dipulihkan, terpisah dari properti masing-masing objek. Berkas diberi penanda versi 1.6 pada nama file dan `appVersion` di dalam JSON.
- Pesan hasil simpan/muat dan status bawah menampilkan jumlah pemberat. Tekan **Tambah Pemberat** agar objek masuk proyek sebelum menyimpan. Pengaturan jenis dan ukuran form pada `ballastTemplate` terpisah dari objek aktual di `frames`. File dengan 0 objek pemberat hanya dapat memulihkan objek yang memang tersimpan; tambahkan pemberat kembali lalu simpan JSON baru.
- Seluruh geometri proyek baru disiapkan sebelum mengganti proyek aktif. Jika pemuatan gagal, proyek sebelumnya tetap dipertahankan; impor tidak meninggalkan sebagian objek terpasang.
- **Simpan JSON** mengunduh proyek: seluruh frame, nama, dimensi, jarak hollow tengah, posisi, rotasi, preferensi snap/grid, dan keadaan kamera. Simpan sebelum menutup halaman; tidak ada penyimpanan otomatis.
- **Muat** membaca file JSON lokal dari aplikasi ini. Format, nilai angka, batas objek, dan profil hollow divalidasi sebelum mengganti proyek. File rusak ditolak tanpa mengubah objek saat ini. Ukuran file maksimal 5 MB.
- **Export PNG** mengunduh tampilan 3D saat ini, termasuk grid dan label dimensi terpilih jika diaktifkan. Gizmo dan panel editor tidak ikut diekspor. PNG mengikuti resolusi viewport dengan rasio piksel perangkat maksimal 2.
- Browser menyimpan file di folder unduhan atau lokasi yang Anda pilih. Izinkan unduhan jika browser menanyakannya.

## Rekap material terpakai

Panel **Material terpakai** terletak di kanan, di bawah area properti, dan tetap terlihat saat properti digulir. Rekap menghitung frame, hollow lurus, LED Screen, jerigen air bertali, dan balok semen secara terpisah berdasarkan jenis dan ukuran dalam mm, beserta totalnya. Hollow lurus dikelompokkan berdasarkan panjang. Pemberat dikelompokkan berdasarkan ketiga dimensi lokal; perbedaan kedalaman tidak digabung.

Jumlah diperbarui setelah Add Frame, duplikat, hapus, perubahan ukuran, Undo/Redo, proyek baru, dan muat JSON. Rotasi tidak mengubah kelompok ukuran: 1 × 2 m dan 2 × 1 m digabung. Perbedaan jarak hollow tidak memisahkan kelompok ukuran. Ringkasan frame tetap disimpan sebagai `summary`, sedangkan gabungan material disimpan sebagai `objectsSummary`; saat memuat, angka di panel dihitung kembali dari objek aktual.

Format JSON tetap kompatibel dengan versi sebelumnya. Jika JSON lama tidak memiliki `frameTemplate`, form Buat frame diisi dari frame pertama. Bila sebuah file lama sama sekali tidak memiliki `braceSpacingMm`, jarak yang hilang tidak dapat ditebak; isi kembali pada panel properti lalu simpan menggunakan versi terbaru.

## Pintasan

| Tombol | Fungsi |
|---|---|
| W | Mode geser |
| E | Mode putar |
| F | Fit semua objek |
| Esc | Batalkan geseran aktif / lepaskan pilihan |
| Ctrl+A | Pilih semua objek |
| Ctrl+C / Ctrl+V | Copy / paste pilihan |
| Ctrl+G | Buat grup dari pilihan |
| Ctrl+Shift+G | Lepas grup |
| Ctrl+D | Duplikat pilihan |
| Delete / Backspace | Hapus pilihan |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+S | Simpan JSON |

Pintasan pengeditan tidak mengambil alih saat sedang mengetik pada kolom. Pada macOS, Command dapat menggantikan Ctrl.

## Layar kecil

Panel kiri dan kanan berubah menjadi panel buka/tutup melalui **Frame & objek** dan **Properti** di atas area kerja. Panel properti dapat digulir. Untuk penyusunan rumit, mouse dan layar desktop memberi ruang kerja lebih luas.

## File dan pengembangan

- `Contruction-Builder-LED-Rental.html`: aplikasi mandiri satu file, bisa dibuka langsung.
- `index.html`, `styles.css`, `app.bundle.js`: versi file terpisah, juga bisa dibuka langsung.
- `src/app.js`: antarmuka, geometri, kamera dan interaksi Three.js.
- `src/project.js`: format proyek dan validasi.
- `src/geometry.js`: geometri pemberat dan tekstur beton lokal.
- `tests/project.test.js`: pemeriksaan format proyek, batas dimensi, angka, snap, dan kamera.
- `tests/browser-smoke.mjs`: pemeriksaan browser opsional dengan Playwright; jalankan `node tests/browser-smoke.mjs` jika Playwright dan Chromium tersedia. `PLAYWRIGHT_MODULE` dan `CHROME_PATH` dapat menunjuk instalasi yang sudah ada. Hasil tersimpan di `.verification/`.
- `tests/attachments-browser.mjs`: pemeriksaan browser untuk kunci objek, pemilihan hollow melalui klik, tali yang mengikuti transformasi, penghapusan tujuan, Undo/Redo, JSON, dan layar kecil. Jalankan dengan konfigurasi Playwright yang sama.
- `tests/selection-browser.mjs`: pemeriksaan impor tanpa pemberat, penambahan/simpan/muat kedua pemberat, Ctrl+A/C/V/G, grup, transformasi bersama, kunci, dan Undo/Redo. `IMPORT_FIXTURE` opsional menunjuk JSON proyek 21 objek untuk memeriksa file lokal dengan pola 20 frame + 1 LED; tanpa variabel ini dipakai berkas uji sintetis.
- `THREE-LICENSE.txt`: lisensi MIT Three.js.

Jika mengubah sumber, jalankan `npm install` sekali, lalu `npm run build` dari folder ini. Build memperbarui bundle dan HTML mandiri. Pemeriksaan format data dapat dijalankan dengan `npm test` (memerlukan Node.js).

Aplikasi ini menghasilkan ilustrasi geometri dan penempatan manual. Analisis kekuatan struktur, detail las, beban, angkur, serta daftar potong material tidak termasuk.
