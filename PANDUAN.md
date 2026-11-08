# Panduan Admin Nabur Moment

Panduan singkat untuk mengelola situs, booking, dan keuangan Nabur Moment.

- **Admin:** https://nabur-moment.vercel.app/admin (nanti pindah ke domain sendiri)
- **Situs:** https://nabur-moment.vercel.app

Masuk dengan email dan kata sandi dari pemilik. Lupa kata sandi? Pemilik bisa membuat kata sandi baru di **Akses & Peran → Pengguna → Reset kata sandi**.

Menu yang tampil mengikuti peran Anda. Pemilik melihat semua menu.

---

## Cara kerja konten: draf → Terbitkan

Semua isi situs (halaman, portofolio, paket, testimoni, FAQ, pengaturan situs) bekerja dengan cara yang sama:

1. Perubahan **tersimpan otomatis sebagai draf**. Pengunjung belum melihatnya.
2. Label **Belum diterbitkan** muncul bila ada draf yang berbeda dari situs.
3. **Pratinjau** membuka situs dengan draf Anda (hanya Anda yang melihatnya, karena sedang masuk sebagai admin).
4. **Terbitkan** menayangkan draf. Situs berubah dalam beberapa detik.
5. **Kembalikan** membuang draf dan kembali ke versi yang sedang tayang.

## Halaman

**Konten → Halaman → Ubah** di baris halaman (Beranda, Tentang, Paket, FAQ, Portofolio, Booking).

- Setiap halaman terdiri dari beberapa **bagian** (Hero, Kolase foto, Testimoni, …). Isi teks, pilih foto, atau sembunyikan bagian yang tidak dipakai.
- Teks panjang punya tombol **Tebal**, **Miring**, dan **Tautan**.
- Bagian **SEO & bagikan** di setiap halaman: judul dan deskripsi untuk Google, serta gambar yang muncul saat link dibagikan di WhatsApp / Instagram. Bila kosong, dipakai isian bawaan dari Pengaturan → Situs.
- Halaman tidak bisa diterbitkan bila ada foto **tanpa teks alternatif (alt)**. Isi alt-nya dulu di Konten → Media.

## Media (foto & video)

**Konten → Media**

- **Unggah:** seret file ke kotak unggah, atau klik untuk memilih. Foto otomatis diperkecil dan diubah ke WebP agar situs cepat. Video harus **MP4**.
- **Embed:** tempel tautan Instagram, TikTok, atau YouTube lewat **Tambah embed**.
- Klik sebuah media untuk mengisi:
  - **Teks alternatif (alt):** gambaran singkat isi foto, misalnya "Pengantin bergandengan tangan di pelaminan". Wajib untuk foto yang tayang di situs (membantu pengunjung tunanetra dan Google).
  - **Titik fokus:** klik bagian terpenting foto (misalnya wajah) agar tidak terpotong di layar HP.
  - **Dipakai di:** daftar tempat media ini dipakai.
- **Hapus media** hanya bisa bila media tidak dipakai di mana pun. Lepaskan dulu dari halaman / album.
- **Saring media** untuk menampilkan foto, video, embed, atau yang belum dipakai.

## Portofolio

**Konten → Portofolio**

- **Album baru:** judul, jenis acara, tanggal, venue, kota, cerita singkat. **Alamat (slug)** dibuat otomatis dari judul.
- **Tambah media ke album:** pilih foto / video / embed dari Media atau unggah baru. Ubah urutan dengan menyeret atau tombol **Naikkan** / **Turunkan**.
- **Jadikan sampul** pada foto yang mewakili album.
- Centang **Album pilihan** agar album tampil di Beranda.
- Hapus centang **Tampilkan di situs** untuk menyembunyikan album tanpa menghapusnya.
- Tekan **Terbitkan** di daftar album agar perubahan tayang.

## Paket, Testimoni, FAQ

**Konten → Paket / Testimoni / FAQ.** Satu tombol **Terbitkan** untuk seluruh daftar.

- **Paket:** tab **Paket**, **Add-on**, dan **Kategori**.
  - Kategori (misalnya Wedding, Akad, Lamaran) dibuat di tab **Kategori → + Kategori**. Kategori tanpa paket tidak tampil di situs.
  - Paket: nama, harga, **Yang didapat** (satu baris per poin), **Catatan kecil**, gambar (opsional). Centang **Unggulan** untuk menonjolkan satu paket.
  - Harga add-on dipakai saat menyusun harga booking.
- **Testimoni:** nama, acara, isi testimoni, foto (opsional).
- **FAQ:** pertanyaan dan jawaban.
- Ubah urutan dengan menyeret, atau tombol **Naikkan** / **Turunkan** (bisa dengan keyboard).
- Sembunyikan satu baris tanpa menghapusnya dengan tombol mata.

## Pengaturan situs

**Pengaturan → Situs:** nama usaha, logo (terang dan gelap), nomor WhatsApp, email, Instagram, TikTok, kalimat di footer, serta judul, deskripsi, dan gambar bawaan untuk SEO. Sama seperti halaman: draf → **Pratinjau** → **Terbitkan**.

Nomor WhatsApp boleh ditulis `0812…`, `+62 812…`, atau `62812…`. Semua disimpan sebagai `62812…`.

## Inquiry dari situs

Formulir di halaman **Booking** situs membuat **klien** (atau memakai klien yang sudah ada bila nomor WhatsApp sama) dan **booking** baru di kolom **Inquiry**. Lihat bagian Booking di bawah.

---

## Booking

**Alur singkat:** Inquiry → Konsultasi → Penawaran → Booked → Persiapan → Hari H → Editing → Selesai (atau Batal).

- **Inquiry dari website** masuk otomatis ke kolom **Inquiry** di menu **Booking**. Pesan dari klien tampil di halaman booking, bagian _Catatan_.
- **Booking baru manual:** Booking → **Booking baru**. Pilih klien (atau ketik klien baru), isi judul, jenis acara, lalu **sesi** (lamaran, akad, resepsi…, masing-masing dengan tanggal, jam, venue). Tanggal sesi pertama = **Hari H**.
- **Paket & harga:** pilih paket, tambahkan add-on bila ada. _Harga disepakati_ terisi otomatis (paket + add-on) dan boleh diubah. Tidak ada diskon.
- **Pindah tahap:** seret kartu di papan, atau tombol **⋯ → Pindah ke…** (juga **Pindah tahap** di halaman booking).
  - Ke **Booked** dan seterusnya hanya bisa setelah **DP lunas**.
  - Ke **Batal** wajib menulis alasan. DP yang sudah dibayar tetap dihitung pemasukan; pelunasan dibatalkan dan invoice yang belum dibayar otomatis dibatalkan.
  - Ke **Selesai** padahal masih ada sisa tagihan: muncul konfirmasi dulu.
- **Halaman booking** (klik judul kartu): sesi, paket, jadwal pembayaran, invoice, pembayaran, biaya, ringkasan laba, aktivitas, pengiriman (link Google Drive, tanggal raw & edited dikirim).
- **Aktivitas:** catat telepon, WhatsApp, pertemuan, atau catatan di kotak _Aktivitas_. Perpindahan tahap, invoice, pembayaran, dan biaya tercatat sendiri.
- **Kalender:** sesi yang **penuh** = DP lunas, **garis putus-putus** = belum DP (tentatif). Ikon peringatan = ada 2 booking atau lebih di tanggal itu (boleh, hanya peringatan). Hapus centang _Tampilkan tentatif_ untuk menyembunyikan yang belum DP.

## Pembayaran

**Jadwal pembayaran** dibuat otomatis untuk setiap booking: **DP 50%** (tetap) dan **Pelunasan 50%**, jatuh tempo di Hari H. Kalau harga atau tanggal sesi berubah, jadwal ikut menyesuaikan.

- **Catat pembayaran:** di halaman booking, tombol **Catat pembayaran** (atau menu **Keuangan → Pembayaran**).
  1. Pilih _Untuk_: invoice yang masih terbuka, atau termin DP / Pelunasan.
  2. Jumlah terisi sisa tagihan; ubah bila klien membayar sebagian.
  3. Tanggal bayar, metode (transfer, tunai, e-wallet, lainnya).
  4. **Bukti pembayaran** (opsional): unggah tangkapan layar transfer (JPG / PNG / WebP, maks. 10 MB). Bukti disimpan **privat**, hanya bisa dibuka dari admin.
- Setiap pembayaran mendapat nomor **kwitansi** otomatis: `KW/NM/2026/11/001`.
- Saat **DP lunas**, aplikasi menawarkan **Pindahkan ke Booked**. Tanggalnya langsung terkunci (penuh) di kalender.
- **Salah catat?** Hapus pembayaran (ikon tempat sampah), lalu catat ulang. Pembayaran DP tidak bisa dihapus setelah booking Booked: pindahkan dulu ke Penawaran.
- Data lama boleh dimasukkan dengan **tanggal lampau**; nomor kwitansi mengikuti bulan tanggal bayar.

## Invoice & kwitansi

- **Buat invoice:** di halaman booking, bagian _Pembayaran_, tombol **Buat invoice** di baris DP atau Pelunasan. Satu termin hanya punya satu invoice aktif.
  - Tagihan lain (jam tambahan, reels tambahan…): tombol **Invoice lain**, isi baris tagihan sendiri.
- Nomor invoice otomatis: `INV/NM/2026/11/001` (urut per bulan).
- Di halaman invoice: **Tandai terkirim** setelah dikirim ke klien, **Unduh PDF** (atau _Lihat PDF_), **Batalkan (void)** bila salah. Invoice tidak pernah dihapus, hanya dibatalkan. Invoice yang sudah ada pembayarannya tidak bisa dibatalkan.
- Status: _Draf_ → _Terkirim_ → _Dibayar sebagian_ / _Lunas_. Lewat jatuh tempo dan belum lunas = _Terlambat_.
- **Kwitansi PDF:** ikon unduh di setiap baris pembayaran (halaman booking atau menu Pembayaran).
- PDF memakai nama usaha, kontak, dan **rekening BCA** dari **Pengaturan → Bisnis & Keuangan**. Isi nomor rekening dan atas nama di sana sebelum mengirim invoice pertama.

## Pengeluaran

- Menu **Keuangan → Pengeluaran → Catat pengeluaran**, atau **Tambah biaya** di halaman booking.
- Pilih **booking** bila biaya untuk acara tertentu (fee kru, transport, akomodasi): ini **biaya langsung** dan mengurangi laba booking itu.
- Kosongkan booking (**Overhead**) untuk biaya usaha umum: iklan, langganan aplikasi, alat.
- Foto **nota** boleh diunggah (disimpan privat).
- **Kategori** pengeluaran diatur di **Pengaturan → Bisnis & Keuangan**: ubah nama, tambah, arsipkan. Kategori yang sudah dipakai tidak bisa dihapus, cukup diarsipkan.

## Dashboard & Laba Rugi

- **Dashboard:** pilih periode (Harian / Mingguan / Bulanan / Tahunan / Custom, panah ‹ › untuk mundur/maju).
  - **Pemasukan** = pembayaran masuk di periode itu (menurut tanggal bayar).
  - **Pengeluaran** = biaya langsung + overhead (menurut tanggal pengeluaran).
  - **Laba bersih** = pemasukan − pengeluaran.
  - **Piutang** = sisa tagihan semua booking aktif.
  - Angka kecil di bawahnya membandingkan dengan periode sebelumnya.
  - Di bawahnya: grafik pemasukan vs pengeluaran (klik _Lihat sebagai tabel_ untuk angkanya), acara 30 hari ke depan, invoice jatuh tempo / terlambat, ringkasan pipeline, inquiry baru.
- **Laba Rugi** (Keuangan → Laba Rugi): pilih tahun; tabel per bulan berisi Pemasukan, Biaya langsung, Overhead, Laba bersih, dan total setahun. Total setahun sama dengan Dashboard periode _Tahunan_.
- Laba per booking ada di halaman booking, bagian **Ringkasan** (dibayar − biaya).

---

## Akses & Peran (pemilik saja)

- **Pengguna → Tambah pengguna:** nama, email, peran. Aplikasi membuat **kata sandi**: salin dan kirim ke orangnya. Ia langsung bisa masuk. Bila lupa, pemilik membuat kata sandi baru lewat **Reset kata sandi**.
- **Peran → Buat peran:** beri nama (misalnya "Admin Keuangan"), lalu centang di **Matriks akses** menu apa saja yang boleh dilihat, ditambah, diubah, atau dihapus.
- **Nonaktif:** cabut akses seseorang tanpa menghapus datanya. Ia langsung tidak bisa masuk.
- Menu Akses & Peran hanya untuk pemilik dan tidak bisa diberikan ke peran lain.

## Cadangan data

- **Database** (booking, klien, pembayaran, konten) tersimpan di Neon. Data bisa **dipulihkan ke titik waktu mana pun dalam 6 jam terakhir** (batas paket gratis). Bila ada data terhapus atau salah ubah, **segera** hubungi pengelola teknis. Lewat 6 jam, data tidak bisa dipulihkan.
- **Foto, video, bukti pembayaran, dan nota** tersimpan di penyimpanan file Neon. Simpan juga file asli di Google Drive Anda.
- Invoice tidak pernah dihapus (hanya dibatalkan), jadi nomor invoice dan kwitansi selalu urut.
