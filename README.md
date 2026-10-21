# Line Monitor

Aplikasi statis HTML, CSS, dan JavaScript untuk monitoring efisiensi produksi, downtime, dan repair ratio. Data disimpan pada `localStorage` browser.

## Deploy ke Vercel
1. Ekstrak ZIP ini.
2. Upload folder proyek ke repository GitHub.
3. Di Vercel pilih **Add New → Project**, lalu import repository.
4. Framework Preset: **Other**.
5. Build Command dan Output Directory boleh dikosongkan; aplikasi ini statis dan `index.html` ada di root.
6. Klik **Deploy**.

## Catatan penyimpanan
`localStorage` hanya tersedia pada browser dan perangkat tempat data diinput. Data tidak otomatis tersinkron antar-HP/komputer dan bisa hilang jika data situs browser dihapus. Gunakan tombol ekspor CSV atau menu ekspor cadangan JSON secara berkala.

## Perhitungan
- CT detik/PCS = 60 ÷ CT menit/PCS.
- Standard PCS = waktu input (menit) ÷ CT menit/PCS.
- Efisiensi = aktual PCS ÷ target PCS × 100%. Jika target manual kosong/0, standard PCS otomatis menjadi target.
- Downtime (%) = downtime menit ÷ waktu standar downtime × 100%.
- Repair ratio (%) = PCS repair ÷ aktual PCS × 100%.

Waktu standar downtime default 450 menit dan dapat diatur per line. Jika aktual PCS 0, repair ratio ditampilkan 0%.
