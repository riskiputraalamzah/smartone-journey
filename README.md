# 🚀 SmartOne Journey

Selamat datang di **SmartOne Journey**, sebuah permainan papan digital berbasis web yang dirancang untuk memberikan edukasi literasi keuangan dengan cara yang menyenangkan dan interaktif.

## 📝 Deskripsi Proyek (5W+1H)

*   **What (Apa):** SmartOne Journey adalah sebuah game simulasi keuangan sederhana dalam format permainan papan monopoli. Pemain melempar dadu, bergerak di atas papan, dan menghadapi berbagai skenario finansial seperti pendapatan, pengeluaran, pajak, dan tabungan.

*   **Why (Mengapa):** Proyek ini dibuat sebagai media pembelajaran alternatif untuk mengenalkan konsep-konsep dasar keuangan. Daripada belajar melalui teks yang monoton, game ini menawarkan pengalaman langsung yang lebih menarik dan mudah dipahami.

*   **Who (Siapa):** Target utama dari game ini adalah pelajar, mahasiswa, atau siapa saja yang ingin mulai belajar tentang manajemen keuangan pribadi dengan cara yang tidak membosankan.

*   **When (Kapan):** Game ini dapat dimainkan kapan saja, baik untuk mengisi waktu luang, sebagai bagian dari materi pembelajaran di kelas, atau sebagai sarana diskusi tentang keuangan.

*   **Where (Di mana):** Sebagai aplikasi berbasis web, game ini dapat diakses dan dimainkan di berbagai perangkat yang memiliki browser, seperti laptop, PC, tablet, dan smartphone.

*   **How (Bagaimana):** Pemain memilih kategori finansial dan jumlah pemain. Secara bergiliran, mereka melempar dadu 3D dan pionnya akan bergerak. Setiap kotak di papan memiliki efek finansial yang berbeda. Terdapat juga kotak bonus di mana pemain harus menjawab kuis edukasi untuk mendapatkan hadiah poin.

## ✨ Fitur Utama

*   **Gameplay Dinamis**: Papan permainan dan skenario dibuat secara dinamis dari file `data_game.json`, memungkinkan kustomisasi konten yang mudah.
*   **Responsif & Mobile-Friendly**: Tampilan game dirancang agar dapat beradaptasi di berbagai ukuran layar, mulai dari desktop hingga mobile, dengan sidebar khusus untuk info pemain di layar kecil.
*   **Animasi 3D**: Animasi lemparan dadu dibuat dalam bentuk kubus 3D untuk memberikan pengalaman yang lebih imersif.
*   **Edukasi Interaktif**: Terdapat kuis-kuis di tengah permainan untuk menguji pengetahuan pemain dan memberikan bonus.
*   **Manajemen State**: Sistem level pemain berdasarkan total poin yang dimiliki, mendorong pemain untuk mengumpulkan poin sebanyak-banyaknya.

## ⚙️ Cara Menjalankan Proyek

Proyek ini adalah aplikasi web statis murni (HTML, CSS, JavaScript) dan tidak memerlukan proses *build* yang kompleks.

**Metode 1: Buka Langsung (Tidak Direkomendasikan)**

Anda bisa saja membuka file `index.html` langsung di browser. Namun, karena proyek ini menggunakan `fetch()` untuk memuat `data_game.json`, beberapa browser mungkin akan memblokir permintaan tersebut karena kebijakan keamanan (CORS).

**Metode 2: Menggunakan Live Server (Direkomendasikan)**

Cara terbaik untuk menjalankan proyek ini adalah dengan menggunakan server lokal.

1.  **Install Ekstensi Live Server**: Jika Anda menggunakan Visual Studio Code, install ekstensi **Live Server** dari marketplace.
2.  **Jalankan Server**:
    *   Buka proyek ini di VS Code.
    *   Klik kanan pada file `index.html`.
    *   Pilih "Open with Live Server".
3.  Browser akan otomatis terbuka dengan alamat seperti `http://127.0.0.1:5500/index.html` dan game siap dimainkan.

## 📂 Struktur Proyek & Penjelasan Skrip

Berikut adalah penjelasan untuk setiap file utama dalam proyek ini:

*   `index.html`
    *   **Fungsi**: Sebagai kerangka utama aplikasi. File ini berisi semua struktur HTML untuk berbagai layar (landing, setup, game), papan permainan, pion, dadu 3D, serta dialog modal untuk kuis dan panduan cara bermain.

*   `styles.css`
    *   **Fungsi**: Bertanggung jawab atas seluruh aspek visual, termasuk layout, warna, tipografi, animasi, dan desain responsif. Di sinilah logika untuk sidebar mobile dan animasi kubus 3D didefinisikan.

*   `game.js`
    *   **Fungsi**: Ini adalah otak dari permainan. Skrip ini menangani semua logika game, seperti:
        *   Memuat data permainan dari `data_game.json`.
        *   Membuat papan permainan (board) dan pemain (players).
        *   Mengelola giliran pemain.
        *   Mengontrol animasi dan hasil lemparan dadu.
        *   Menggerakkan pion pemain di papan.
        *   Menerapkan efek dari setiap kotak (income, expense, bonus, dll).
        *   Menampilkan dan mengelola sistem kuis.
        *   Memperbarui antarmuka pengguna (UI), seperti poin pemain.
        *   Mengatur fungsionalitas sidebar di layar mobile.

*   `data_game.json`
    *   **Fungsi**: Pusat data untuk konten game. File ini berisi:
        *   **Kategori**: Berbagai set permainan yang bisa dipilih (misal: "Keuangan Pribadi", "Wirausaha").
        *   **Tiles**: Definisi untuk setiap kotak di papan, termasuk tipe, judul, dan efeknya.
        *   **QuizBank/QuizLevels**: Kumpulan pertanyaan kuis beserta pilihan dan jawaban yang benar.
        *   **EduText**: Teks edukasi singkat yang terkait dengan jenis-jenis kotak.

## 🛠️ Teknologi yang Digunakan

*   **HTML5**: Untuk struktur dan markup konten.
*   **CSS3**: Untuk styling, layout (Grid), animasi (Keyframes), dan desain responsif (Media Queries).
*   **JavaScript (ES6+)**: Untuk semua logika permainan dan interaktivitas DOM.
