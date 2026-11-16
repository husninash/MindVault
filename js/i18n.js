// MindVault language switch (Bahasa Indonesia / English).
// The app's text is written in a mix of both languages. Instead of rewriting every string,
// this layer swaps whole text nodes (and placeholders/titles) using the dictionary below,
// in either direction, and keeps doing it for anything rendered later (MutationObserver).
// User content is left alone unless it exactly matches a UI string; mark an element with
// data-no-i18n to opt it out completely.
const I18N = {
  lang: 'id',
  storageKey: 'MINDVAULT_LANG',

  // [Bahasa Indonesia, English]
  pairs: [
    // ---- Navigation & shell ----
    ['Navigasi Utama', 'Main Navigation'],
    ['Dasbor', 'Dashboard'],
    ['Daftar Teman', 'Friends Directory'],
    ['Catatan Percakapan', 'Conversation Diary'],
    ['Topik Hari Ini', "Today's Topics"],
    ['Belajar', 'Learn'],
    ['Kosakata Inggris', 'English Vocab'],
    ['Kecerdasan', 'Intelligence'],
    ['Peta Hubungan', 'Knowledge Graph'],
    ['Pengingat', 'Reminders'],
    ['Konsol Admin', 'Admin Console'],
    ['Pasang di HP', 'Install on phone'],
    ['Pengaturan', 'Settings'],
    ['Keluar', 'Log Out'],
    ['Notifikasi', 'Notifications'],
    ['Persiapan Ketemu', 'Meeting Prep'],
    ['Catat Momen', 'Log Memory'],
    ['Notifikasi & Pengingat', 'Notifications & Reminders'],
    ['Tidak ada notifikasi saat ini.', 'No notifications right now.'],
    ['Lihat Semua Pengingat', 'See all reminders'],
    ['Cari teman, catatan, topik, kado, kosakata...', 'Search friends, notes, topics, gifts, vocab...'],
    ['Cari', 'Search'],
    ['Bahasa', 'Language'],
    ['Pengguna', 'User'],
    ['Tamu', 'Guest'],

    // ---- Search results ----
    ['Total teman', 'Friends'],
    ['Teman-teman', 'People'],
    ['Teman', 'Friend'],
    ['Catatan', 'Notes'],
    ['Jurnal harian', 'Daily journal'],
    ['Topik obrolan', 'Conversation topics'],
    ['Ide kado', 'Gift ideas'],
    ['Kosakata', 'Vocab'],
    ['Topik simpanan', 'Saved topic'],

    // ---- Dashboard ----
    ['Skor hubungan', 'Relationship score'],
    ['Topik tersimpan', 'Saved topics'],
    ['Bahan obrolan hari ini', "Today's conversation starters"],
    ['Dari berita terbaru, disesuaikan dengan minat temanmu', "From the latest news, matched to your friends' interests"],
    ['Perbarui', 'Refresh'],
    ['Mencari...', 'Searching...'],
    ['Catatan terakhir', 'Recent notes'],
    ['Lihat semua', 'See all'],
    ['Yang akan datang', 'Coming up'],
    ['Alat bantu', 'Tools'],
    ['Persiapan ketemuan', 'Meeting prep'],
    ['Latihan ngobrol', 'Practice a chat'],
    ['Peta relasi', 'Relationship map'],
    ['Ulangi kosakata', 'Review vocab'],
    ['Hari ini', 'Today'],
    ['Besok', 'Tomorrow'],
    ['Sumber', 'Sources'],
    ['Cari berita lain', 'Find more news'],
    ['Cari beritanya', 'Find the article'],
    ['Topik simpananmu', 'Your saved topics'],
    ['Belum ada topik hari ini.', 'No topics yet today.'],
    ['Mencari berita terbaru untuk bahan obrolan...', 'Looking for the latest news to talk about...'],
    ['Tidak ada ulang tahun atau momen spesial dalam 30 hari ke depan.', 'No birthdays or special moments in the next 30 days.'],
    ['· cocok untuk', '· good for'],
    ['Isi', 'Add your'],
    ['di Settings supaya topik obrolan diambil dari berita terbaru.', 'in Settings to get conversation topics from the latest news.'],
    ['Belum ada catatan. Setelah ngobrol dengan teman, klik', 'No notes yet. After talking with a friend, click'],
    ['untuk mencatatnya.', 'to write it down.'],
    ['Belum ada teman yang dicatat.', 'No friends added yet.'],
    ['Tambahkan teman pertamamu', 'Add your first friend'],
    ['untuk mulai.', 'to get started.'],
    ['Berikutnya:', 'Next up:'],
    ['BELUM ADA DATA', 'NO DATA YET'],
    ['Hubungan sangat harmonis & interaksi berjalan positif bulan ini.', 'Relationships are in great shape and interactions were positive this month.'],
    ['Tambahkan teman atau tulis catatan pertama untuk mulai melihat skor hubunganmu.', 'Add a friend or write your first note to start seeing your relationship score.'],
    ['Hubungan harmonis dan interaksi berjalan sangat positif.', 'Relationships are harmonious and interactions are very positive.'],
    ['Koneksi stabil dan komunikasi terjalin secara aktif.', 'Connections are stable and you keep in touch actively.'],

    // ---- Friends ----
    ['Kelola tingkat kedekatan, favorit, dan ringkasan AI.', 'Manage intimacy tiers, favorites, and AI summaries.'],
    ['Tambah Teman Baru', 'Add New Friend'],
    ['Tambah Teman', 'Add Friend'],
    ['Lihat Profil', 'View Profile'],
    ['Belum ada teman', 'No friends yet'],
    ['Belum ada teman yang ditambahkan. Tambahkan teman pertamamu sekarang!', 'No friends added yet. Add your first friend now!'],
    ['Ubah Profil', 'Edit Profile'],
    ['Siapkan Pertemuan', 'Prep Meeting'],
    ['Latihan Chat', 'Practice Chat'],
    ['Ringkasan Memori AI', 'AI Memory Summary'],
    ['Kabar Terkini', 'Current Life Status'],
    ['Topik Aman', 'Safe Topics'],
    ['Topik Dihindari', 'Avoid Topics'],
    ['Momen & Acara Spesial Mendatang', 'Upcoming Special Moments & Events'],
    ['Tambah Acara', 'Add Event'],
    ['+ Catat Momen Spesial', '+ Log a special moment'],
    ['Favorit', 'Favorites'],
    ['Rekomendasi Kado AI', 'AI Gift Recommendations'],
    ['Belum ada favorit yang diisi. Klik Edit Profile untuk menambahkan.', 'No favorites yet. Click Edit Profile to add some.'],
    ['Belum ada ide hadiah.', 'No gift ideas yet.'],
    ['Belum ada topik aman.', 'No safe topics yet.'],
    ['Belum ada topik yang dihindari.', 'No topics to avoid yet.'],
    ['Belum ada momen atau acara spesial (Wisuda, Lahiran, dll) yang dicatat.', 'No special moments or events (graduation, new baby, etc.) recorded yet.'],
    ['Hapus Teman Ini', 'Delete this friend'],
    ['Hapus Profil Teman', 'Delete friend profile'],
    ['Konflik / Butuh Pemulihan', 'Conflict / Needs Repair'],
    ['Pendinginan / Jarak', 'Cooling Down'],
    ['Skor Kedekatan', 'Intimacy Score'],

    // Relationship types
    ['Sahabat', 'Best Friend'],
    ['Teman Dekat', 'Close Friend'],
    ['Keluarga', 'Family'],
    ['Pasangan', 'Partner'],
    ['Mantan', 'Ex'],
    ['Rekan Kerja', 'Colleague'],
    ['Mentor / Guru', 'Mentor / Teacher'],
    ['Kenalan', 'Acquaintance'],
    ['Lainnya (ketik sendiri)...', 'Other (type your own)...'],

    // Friend form
    ['Tambah Profil Teman Baru', 'Add New Friend Profile'],
    ['Ubah Profil Teman', 'Edit Friend Profile'],
    ['Informasi Dasar', 'Basic Information'],
    ['Nama Lengkap', 'Full Name'],
    ['Hubungan', 'Relationship / Tier'],
    ['Tanggal Lahir', 'Birthday', 'Birthday (Tanggal Lahir)'],
    ['Foto Profil', 'Avatar Photo'],
    ['Pilih Foto dari Perangkat', 'Choose Photo from Device'],
    ['Foto siap disimpan', 'Photo attached ready to save'],
    ['- ATAU tempel URL gambar -', '- OR paste web image URL -'],
    ['No. HP / WhatsApp', 'Phone / WhatsApp'],
    ['(opsional)', '(optional)'],
    ['Alamat', 'Address'],
    ['Bio Ringkas', 'Short Bio', 'Bio / Bio Ringkas'],
    ['Kabar Terbaru', 'Current Life Update'],
    ['Favorit (Opsional)', 'Favorites (Optional)'],
    ['Minuman Favorit', 'Favorite Drink'],
    ['Makanan Favorit', 'Favorite Food'],
    ['Warna Favorit', 'Favorite Color'],
    ['Hobi Favorit', 'Favorite Hobby'],
    ['Buku Favorit', 'Favorite Book'],
    ['Topik & Preferensi (Opsional)', 'Topics & Preferences (Optional)'],
    ['Kesukaan & Minat (pisahkan dengan koma)', 'Likes & Interests (comma-separated)', 'Likes & Interests (Pisahkan dengan koma)'],
    ['Hal yang Tidak Disukai', 'Dislikes', 'Dislikes (Hal yang Dibenci)'],
    ['Topik Aman untuk Dibahas', 'Safe Topics to Discuss', 'Safe Topics (Topik Aman untuk Dibahas)'],
    ['Topik yang Dihindari', 'Topics to Avoid', 'Avoid Topics (Topik Dihindari)'],
    ['Ide Kado (Opsional)', 'Gift Ideas (Optional)'],
    ['Ide Hadiah (Format: Nama Barang (Harga))', 'Gift ideas (format: Item (Price))', 'Ide Hadiah (Format: Nama Barang ($Harga))'],
    ['Simpan Profil Teman', 'Save Friend Profile'],
    ['Buat Profil Teman', 'Create Friend Profile'],
    ['Simpan Perubahan', 'Save Changes'],
    ['Ketik hubungan kustom...', 'Type a custom relationship...', 'Ketik relationship / tier kustom...'],
    ['mis. Chloe Bennett', 'e.g. Chloe Bennett'],
    ['mis. 0812 3456 7890', 'e.g. +62 812 3456 7890'],
    ['mis. @username', 'e.g. @username'],
    ['mis. Jl. Melati No. 12, Medan', 'e.g. 12 Melati St, Medan'],
    ['mis. Suka kopi, desainer UI, hobi jalan-jalan ke Tokyo', 'e.g. Coffee enthusiast, UI designer, loves Tokyo travel'],
    ['Apa yang sedang terjadi dalam hidupnya sekarang? (Opsional)', 'What is happening in their life right now? (Optional)'],
    ['https://images.unsplash.com/... (URL opsional)', 'https://images.unsplash.com/... (Optional URL)'],

    // ---- Diary / journals ----
    ['Jurnal, Refleksi & Catatan Mimpi', 'Journal, Reflection & Dream Log'],
    ['Catat momen percakapan, refleksi harian, dan alur cerita mimpi pribadi.', 'Record conversation moments, daily reflections, and your personal dream stories.'],
    ['Log Cerita Mimpi', 'Log a Dream'],
    ['Refleksi Harian', 'Daily Reflection'],
    ['Catat Momen Teman', 'Log Friend Memory', 'Log Memory Teman'],
    ['Kenangan Percakapan', 'Conversation Memories'],
    ['Jurnal Harian', 'Daily Journal', 'Jurnal Harian (Daily Reflections)'],
    ['Jurnal Mimpi', 'Dream Journal', 'Dream Journal (Alur Cerita Mimpi)'],
    ['Belum ada catatan jurnal.', 'No journal entries yet.'],
    ['Belum ada jurnal harian. Klik', 'No daily journal yet. Click'],
    ['untuk menulis jurnal pertama Anda hari ini!', 'to write your first entry today!'],
    ['Belum ada alur cerita mimpi yang dicatat. Klik', 'No dreams recorded yet. Click'],
    ['untuk mencatat mimpi pertamamu!', 'to record your first dream!'],
    ['Catat Momen / Percakapan Baru', 'Log New Memory / Conversation'],
    ['Ubah Catatan Momen', 'Update Memory Log'],
    ['Judul Catatan / Momen', 'Note / Moment Title'],
    ['Pilih Teman', 'Choose a Friend'],
    ['Pilih Teman...', 'Choose a friend...'],
    ['Tanggal / Hari Percakapan', 'Date of the Conversation'],
    ['Mood Percakapan', 'Conversation Mood'],
    ['Bersemangat & Terinspirasi', 'Energetic & Inspired'],
    ['Termotivasi & Fokus', 'Motivated & Focused'],
    ['Kreatif & Hangat', 'Creative & Warm'],
    ['Serius & Emosional', 'Serious & Emotional'],
    ['Santai & Rileks', 'Chill & Relaxed'],
    ['Detail Memory & Hasil Percakapan', 'Memory Details & What You Talked About'],
    ['Simpan Catatan Momen', 'Save Memory Log'],
    ['Jurnal Harian & Refleksi Diri', 'Daily Journal & Self-Reflection'],
    ['Judul Jurnal / Refleksi', 'Journal / Reflection Title'],
    ['Tanggal', 'Date'],
    ['Mood Hari Ini', "Today's Mood"],
    ['Bersyukur & Bahagia', 'Grateful & Happy'],
    ['Termotivasi & Produktif', 'Motivated & Productive'],
    ['Tenang & Damai', 'Calm & Peaceful'],
    ['Merenung', 'Reflective'],
    ['Lelah & Istirahat', 'Tired & Resting'],
    ['Isi Jurnal Hari Ini', "Today's Journal Entry"],
    ['Hal yang Disyukuri Hari Ini (Gratitude)', 'What I Am Grateful For Today'],
    ['Simpan Jurnal Harian', 'Save Daily Journal'],
    ['Hal yang Disyukuri:', 'Grateful for:'],
    ['Log Alur Cerita Mimpi', 'Log a Dream Story'],
    ['Judul Cerita Mimpi', 'Dream Title'],
    ['Tanggal / Malam Mimpi', 'Date / Night of the Dream'],
    ['Sensasi & Tipe Mimpi', 'Dream Type & Feeling'],
    ['Lucid Dream (Sadar Bermimpi)', 'Lucid Dream'],
    ['Vivid & Indah (Penuh Warna)', 'Vivid & Beautiful'],
    ['Aneh & Surreal (Surealis)', 'Strange & Surreal'],
    ['Mimpi Pertanda & Intuisi', 'Sign & Intuition Dream'],
    ['Mimpi Buruk / Tegang', 'Nightmare / Tense'],
    ['Mimpi Santai & Petualangan', 'Relaxed & Adventure Dream'],
    ['Tokoh / Sosok yang Hadir dalam Mimpi', 'People / Figures in the Dream'],
    ['Alur Cerita Mimpi (Detail dari Awal sampai Bangun)', 'Dream Story (From Start to Waking Up)'],
    ['Perasaan / Catatan Saat Terbangun', 'Feelings / Notes on Waking Up'],
    ['Simpan Catatan Mimpi', 'Save Dream Log'],
    ['Ubah Catatan Mimpi', 'Update Dream Log'],
    ['Tokoh:', 'People:'],
    ['Refleksi Saat Terbangun:', 'On waking up:'],
    ['Bersama', 'With'],
    ['Ubah', 'Edit'],
    ['Hapus', 'Delete'],
    ['Hapus Cerita Mimpi', 'Delete dream'],
    ['Hapus Jurnal Harian', 'Delete daily journal'],
    ['Hapus Momen Spesial', 'Delete special moment'],
    ['Refleksi Diri', 'Self-Reflection'],

    // ---- Graph ----
    ['Peta Hubungan & Minat', 'Relationship Knowledge Graph'],
    ['Jaringan visual yang menghubungkan teman, hobi bersama, dan minat yang sama.', 'Visual network connecting friends, mutual hobbies, and shared interests.'],

    // ---- Topics ----
    ['Topik Hari Ini & Renungan Pribadi', "Today's Topics & Personal Thoughts"],
    ['Ide pemantik obrolan dan renungan hubungan pribadi yang tersambung ke AI (RAG Engine).', 'Conversation starters and personal relationship reflections connected to the AI (RAG Engine).'],
    ['Tambah Topik / Renungan', 'Add Topic / Reflection'],
    ['Pemantik Obrolan dari AI', 'AI Suggested Starters'],
    ['RAG Aktif', 'RAG Active'],
    ['Renungan Hubunganku', 'My Relationship Reflections'],
    ['Belum ada pemantik obrolan. Klik tombol "+ Tambah Topik / Renungan" untuk menambah baru.', 'No conversation starters yet. Click "+ Add Topic / Reflection" to add one.'],
    ['Belum ada renungan. Klik tombol "+ Tambah Topik / Renungan" untuk menambah baru.', 'No reflections yet. Click "+ Add Topic / Reflection" to add one.'],
    ['Tambah Topik / Renungan Hubungan', 'Add Topic / Relationship Reflection'],
    ['Kategori Input', 'Category'],
    ['Pemantik obrolan AI', 'AI Suggested Starter', 'AI Suggested Starter (Pemantik Obrolan)'],
    ['Isi Topik / Pemantik / Renungan', 'Topic / Starter / Reflection'],
    ['Simpan ke RAG Database', 'Save to RAG Database'],
    ['Ubah Topik RAG', 'Update RAG Topic', 'Update Topik RAG'],
    ['Pemantik Obrolan', 'Conversation Starter'],
    ['Renungan Hubungan', 'Relationship Reflection', 'Relationship Reflection (Renungan Hubungan)'],

    // ---- Vocab ----
    ['Ketemu kata baru pas nonton? Ketik di sini. Jenis kata, perubahan bentuk, sinonim, antonim, dan contoh kalimat dibuat otomatis.', 'Heard a new word while watching something? Type it here. Word type, word forms, synonyms, antonyms and example sentences are generated automatically.'],
    ['Ulangi kata', 'Review words'],
    ['Analisis', 'Analyze'],
    ['Tambah konteks: kalimat & sumber tontonan', 'Add context: sentence & where you heard it'],
    ['(opsional, bikin lebih gampang ingat)', '(optional, makes it easier to remember)'],
    ['Kosakataku', 'My vocab'],
    ['Belum ada kata.', 'No words yet.'],
    ['Acak', 'Shuffle'],
    ['Contoh: write, overwhelming, figure out', 'e.g. write, overwhelming, figure out'],
    ['Kalimat tempat kamu dengar kata itu, misal: She\'s really striving for that promotion.', 'The sentence where you heard it, e.g. She\'s really striving for that promotion.'],
    ['Sumber, misal: Suits S2E4, podcast, YouTube...', 'Source, e.g. Suits S2E4, podcast, YouTube...'],
    ['Buka kata acak untuk mengulang', 'Open a random word to review'],
    ['Cari di daftar...', 'Filter the list...'],
    ['Kata yang kamu analisis akan tersimpan di sini.', 'Words you analyze are saved here.'],
    ['Ketik kata baru di atas, atau pilih kata dari daftar', 'Type a new word above, or pick one from the list'],
    ['Bentuk kata', 'Word forms'],
    ['Perubahan verb', 'Verb forms'],
    ['Makna & sinonim', 'Meanings & synonyms'],
    ['Sinonim', 'Synonyms'],
    ['Antonim', 'Antonyms'],
    ['Lawan', 'Opposite'],
    ['Pola', 'Patterns'],
    ['Contoh kalimat', 'Example sentences'],
    ['Sering dipakai bareng', 'Common collocations'],
    ['Tidak ada antonim langsung.', 'No direct antonym.'],
    ['ejaan dikoreksi', 'spelling corrected'],
    ['makna di kalimatmu', 'meaning in your sentence'],
    ['Sudah hafal', 'Mastered'],
    ['Belum hafal', 'Not mastered'],
    ['Lupa', 'Forgot'],
    ['Susah', 'Hard'],
    ['Ingat', 'Got it'],
    ['Lihat jawaban', 'Show answer'],
    ['(Spasi)', '(Space)'],
    ['Seberapa ingat kamu?', 'How well did you remember?'],
    ['Ingat artinya? Coba jawab dalam hati dulu.', 'Remember the meaning? Try answering in your head first.'],
    ['Selesai untuk hari ini', 'Done for today'],
    ['Kembali ke daftar', 'Back to the list'],
    ['Perlu diulang hari ini', 'Due for review today'],
    ['Tidak ada yang cocok.', 'No matches.'],
    ['Belum ada kata untuk diulang.', 'No words to review yet.'],
    ['Belum ada kata. Analisis kata pertamamu dulu.', 'No words yet. Analyze your first word.'],
    ['Pakai', 'Use'],
    ['atau', 'or'],

    // ---- Reminders ----
    ['Ulang Tahun & Pengingat Cerdas', 'Upcoming Birthdays & Smart Reminders'],
    ['Belum ada tanggal ulang tahun atau pengingat tersimpan di direktori teman.', 'No birthdays or reminders saved in your friend directory yet.'],
    ['Buka Persiapan Ketemu', 'Open Meeting Prep', 'Buka Meeting Prep'],
    ['Siapkan Kado & Topik', 'Prepare gift & topics'],
    ['Tambah Acara & Momen Spesial Teman', "Add a Friend's Event or Special Moment"],
    ['Tipe Acara / Momen Spesial', 'Event / Moment Type'],
    ['Wisuda', 'Graduation', 'Wisuda / Graduation'],
    ['Kelahiran Anak / Babyshower', 'New Baby / Baby Shower'],
    ['Pernikahan / Lamaran / Anniversary', 'Wedding / Engagement / Anniversary'],
    ['Promosi Kerja / Kantor Baru', 'Promotion / New Job'],
    ['Pindah Rumah / Housewarming', 'Moving / Housewarming'],
    ['Liburan / Perjalanan Spesial', 'Holiday / Special Trip'],
    ['Operasi / Pemulihan Kesehatan', 'Surgery / Recovery'],
    ['Ujian / Sidang / Presentasi Penting', 'Exam / Thesis Defense / Big Presentation'],
    ['Momen Spesial Lainnya', 'Other Special Moment'],
    ['Nama / Judul Acara', 'Event Name'],
    ['Tanggal Acara / Target Tanggal', 'Event Date'],
    ['Catatan / Rencana Kado & Ucapan', 'Notes / Gift & Message Plans'],
    ['Simpan Momen Spesial', 'Save Special Moment'],
    ['Ubah Momen Spesial', 'Update Special Moment', 'Update Momen Spesial'],

    // ---- Settings ----
    ['Pengaturan Pengguna', 'User Settings'],
    ['Profil Pribadi', 'Personal Profile'],
    ['Namamu', 'Your Name'],
    ['Alamat Email', 'Email Address'],
    ['Kutipan / Motto Pribadi', 'Personal Quote / Motto'],
    ['Simpan Profil', 'Save Profile Settings'],
    ['Preferensi Aplikasi', 'App Preferences'],
    ['Tema Warna', 'Theme Style'],
    ['Pink Pastel Lembut (Default)', 'Soft Pastel Pink (Default)'],
    ['Lavender Elegan', 'Elegant Lavender'],
    ['Emerald Segar', 'Fresh Emerald'],
    ['Persona Asisten AI', 'AI Assistant Persona'],
    ['Ramah & Hangat', 'Friendly & Warm'],
    ['Ringkas & Profesional', 'Concise & Professional'],
    ['Empatik & Peduli', 'Empathic & Empathetic'],
    ['Notifikasi Pengingat Harian', 'Daily Reminder Notifications'],
    ['Terima notifikasi harian untuk ulang tahun teman & topik.', 'Receive daily notifications for upcoming friend birthdays & topics.'],
    ['Simpan Preferensi', 'Save Preferences'],
    ['Peran Akun:', 'Account Role:'],
    ['Mode Pengguna Biasa. API key sistem dan pengaturan cloud dikelola Administrator di Konsol Admin.', 'Regular User Mode. System API keys and cloud settings are managed by Administrators in Admin Console.'],
    ['Tampilan bahasa aplikasi. Jawaban AI juga mengikuti bahasa ini.', 'The app\'s display language. AI answers follow it too.'],

    // ---- Admin ----
    ['Konsol Admin & Sistem', 'Admin & System Console'],
    ['Mode Administrator Aktif', 'Administrator Mode Active'],
    ['Keluar dari Mode Admin', 'Exit Admin Mode'],
    ['Status Sinkronisasi Database', 'Database Sync Status'],
    ['Mesin AI', 'AI Intelligence Engine'],
    ['Total Akun Aktif', 'Total Active Accounts'],
    ['Kredensial API & Sinkronisasi Database', 'API Credentials & Database Synchronization'],
    ['Hubungkan & Sinkronkan Supabase', 'Connect & Sync Supabase'],
    ['Tes Koneksi', 'Test Connection'],
    ['Simpan Key AI', 'Save AI Key'],
    ['Tes Key AI', 'Test AI Key'],
    ['Pengguna Sistem & Manajemen Peran', 'System Users & Role Management'],
    ['Muat Ulang', 'Refresh'],
    ['Peran', 'Role'],
    ['Pemeliharaan & Reset Sistem', 'System Maintenance & Reset'],
    ['Hapus Cache Lokal', 'Clear Local Cache'],
    ['Pulihkan Data Contoh', 'Restore Seed Data'],
    ['Aktif', 'Active'],

    // ---- Meeting prep & simulator ----
    ['Contekan Ketemuan 1 Menit', '1-Minute Meeting Cheat-Sheet'],
    ['Ringkasan sebelum ketemu, dibuat oleh MindVault AI', 'Pre-meeting brief generated by MindVault AI'],
    ['Kabar Terbaru:', 'Current Life Update:'],
    ['Topik Aman untuk Dibahas:', 'Safe Topics to Bring Up:'],
    ['Topik yang Dihindari:', 'Topics to Avoid:'],
    ['Siap, Saatnya Ketemu!', 'Got It, Ready to Meet!'],
    ['Simulasi Percakapan (', 'Conversation Simulator ('],
    ['Kirim', 'Send'],
    ['Ketik yang ingin kamu katakan...', 'Type what you want to say...'],
    ['Ringkasan AI:', 'AI Brief:'],
    ['Topik Bagus:', 'Great Topic:'],
    ['Topik Dihindari:', 'Topic to Avoid:'],
    ['Menganalisis memori percakapan & RAG database...', 'Analyzing conversation memories & RAG database...'],

    // ---- Auth & dialogs ----
    ['AI Hubungan & Otak Kedua Pribadi', 'Relationship AI & Personal Second Brain'],
    ['Masuk', 'Log In'],
    ['Daftar', 'Sign Up'],
    ['Masuk ke MindVault', 'Log In to MindVault'],
    ['Buat Akun', 'Create Account'],
    ['Lupa password?', 'Forgot password?'],
    ['← Kembali ke Log In', '← Back to Log In'],
    ['Kirim link reset', 'Send reset link'],
    ['Coba tanpa akun (data hanya tersimpan di browser ini):', 'Try without an account (data stays in this browser only):'],
    ['Pengguna Demo', 'User Demo'],
    ['Masukkan email akunmu. Kami akan mengirim link untuk membuat password baru.', "Enter your account email. We'll send you a link to set a new password."],
    ['Buat password baru untuk akunmu.', 'Create a new password for your account.'],
    ['Password baru (minimal 6 karakter)', 'New password (at least 6 characters)'],
    ['Konfirmasi Keluar', 'Confirm Log Out'],
    ['Apakah Anda yakin ingin keluar (logout) dari MindVault?', 'Are you sure you want to log out of MindVault?'],
    ['Batal', 'Cancel'],
    ['Ya, Keluar', 'Yes, Log Out'],
    ['Apakah Anda yakin ingin menghapus catatan alur cerita mimpi ini?', 'Are you sure you want to delete this dream entry?'],
    ['Apakah Anda yakin ingin menghapus catatan refleksi harian ini?', 'Are you sure you want to delete this daily reflection?'],
    ['Apakah Anda yakin ingin menghapus momen / acara spesial ini?', 'Are you sure you want to delete this special moment?'],

    // ---- Assistant ----
    ['Asisten MindVault', 'MindVault Assistant'],
    ['Asisten AI MindVault', 'MindVault AI Assistant'],
    ['Halo! Aku asisten hubunganmu. Tanya apa saja soal teman-temanmu, obrolan sebelumnya, atau ide kado!', "Hi! I'm your Relationship Intelligence Assistant. Ask me anything about your friends, past conversations, or gift recommendations!"],
    ['Tanya AI soal teman...', 'Ask AI about friends...'],

    // ---- PWA / offline ----
    ['MindVault sudah terpasang di HP-mu.', 'MindVault is already installed on your phone.'],
    ['Kamu offline. Perubahan disimpan di HP dan dikirim otomatis saat online lagi.', "You're offline. Changes are saved on your phone and sent automatically when you're back online."],
    ['Online lagi. Semua perubahan sudah tersinkron.', 'Back online. All changes are synced.'],
    ['Buka menu browser (⋮), lalu pilih "Instal aplikasi" atau "Tambahkan ke layar utama".', 'Open the browser menu (⋮), then choose "Install app" or "Add to Home screen".'],
    ['Di Safari: ketuk tombol Bagikan (kotak dengan panah), lalu pilih "Tambah ke Layar Utama".', 'In Safari: tap the Share button (square with an arrow), then choose "Add to Home Screen".'],

    // ---- Toasts ----
    ['Teman tidak ditemukan.', 'Friend not found.'],
    ['Kunci API AI terverifikasi & aktif.', 'AI API Key verified & active.'],
    ['API Key tersimpan & tersinkron.', 'API Key saved & synced.'],
    ['Akun ini tidak punya akses Admin.', "This account doesn't have Admin access."],
    ['Berhasil keluar (Logged out). Silakan login kembali.', 'Logged out. Please log in again.'],
    ['Catatan cerita mimpi berhasil dihapus.', 'Dream entry deleted.'],
    ['Catatan percakapan berhasil dihapus.', 'Conversation note deleted.'],
    ['Cerita mimpi berhasil disimpan.', 'Dream saved.'],
    ['Berhasil terhubung ke Supabase! Memuat ulang data...', 'Connected to Supabase successfully! Reloading data...'],
    ['Tidak bisa terhubung ke Supabase. Cek kembali kredensialnya.', 'Could not connect to Supabase. Please verify your credentials.'],
    ['Data momen spesial tidak ditemukan.', 'Special moment not found.'],
    ['Tes koneksi database berhasil.', 'Database Connection Test Passed.'],
    ['Catatan mimpi tidak ditemukan.', 'Dream log not found.'],
    ['Ukuran file terlalu besar. Pilih gambar di bawah 5MB.', 'File size too large. Please select an image under 5MB.'],
    ['Isi Gemini API key di Settings dulu.', 'Add your Gemini API key in Settings first.'],
    ['Item tidak ditemukan.', 'Item not found.'],
    ['Jurnal Harian berhasil disimpan.', 'Daily journal saved.'],
    ['Jurnal harian berhasil dihapus.', 'Daily journal deleted.'],
    ['Data offline lokal berhasil dihapus.', 'Local offline data cleared successfully.'],
    ['Catatan momen tidak ditemukan.', 'Memory log not found.'],
    ['Catatan momen berhasil disimpan.', 'Memory log saved successfully.'],
    ['Mohon isi Judul dan Alur Cerita Mimpi.', 'Please fill in the title and the dream story.'],
    ['Mohon isi Judul dan Detail Percakapan.', 'Please fill in the title and the conversation details.'],
    ['Mohon isi Judul dan Isi Jurnal Harian.', 'Please fill in the title and the journal entry.'],
    ['Mohon isi konten topik / renungan.', 'Please fill in the topic / reflection.'],
    ['Mohon lengkapi judul dan tanggal acara.', 'Please fill in the event title and date.'],
    ['Momen spesial berhasil dihapus.', 'Special moment deleted.'],
    ['Berjalan dengan data lokal di browser.', 'Operating in Local Browser Data mode.'],
    ['Password berhasil diganti. Kamu sudah masuk.', 'Password changed. You are now logged in.'],
    ['Pemantik obrolan baru tersimpan ke RAG Database.', 'New conversation starter saved to the RAG Database.'],
    ['Pemantik obrolan berhasil dihapus.', 'Conversation starter deleted.'],
    ['Pemantik obrolan berhasil diperbarui.', 'Conversation starter updated.'],
    ['Pilih atau tambahkan teman terlebih dahulu.', 'Choose or add a friend first.'],
    ['Masukkan API Key yang valid.', 'Please enter a valid API Key.'],
    ['Isi Supabase URL dan Anon Key.', 'Please enter both Supabase URL and Anon Key.'],
    ['Isi namamu dulu.', 'Please enter your name.'],
    ['Pengaturan profil tersimpan & tersinkron.', 'Profile settings updated & synced.'],
    ['Renungan hubungan baru tersimpan ke RAG Database.', 'New relationship reflection saved to the RAG Database.'],
    ['Renungan hubungan berhasil dihapus.', 'Relationship reflection deleted.'],
    ['Renungan hubungan berhasil diperbarui.', 'Relationship reflection updated.'],
    ['Tambahkan teman dulu di Friends Directory.', 'Add a friend in the Friends Directory first.'],
    ['Memakai mesin AI berbasis aturan bawaan.', 'Using default rule-based AI engine.'],
    ['Mode Offline Lokal', 'Local Offline Mode'],
    ['Terhubung ke Supabase', 'Supabase Connected'],
    ['Terhubung ke Backend Supabase Live', 'Connected to Supabase Live Backend'],
    ['Mode Offline (Data Cadangan Lokal Aktif)', 'Offline Mode (Local Fallback Data Active)'],
    ['AI Berbasis Aturan', 'Rule-based AI'],
    ['Gemini AI Siap', 'Gemini AI Ready'],
    ['Bahasa diganti ke Bahasa Indonesia.', 'Language switched to Indonesian.'],
    ['Ulang Tahun', 'Birthday'],
    ['Momen Spesial', 'Special Moment'],
    ['Wisuda / Kelulusan', 'Graduation'],
    ['Pernikahan', 'Wedding'],
    ['Kelahiran', 'New Baby'],
    ['HARI INI', 'TODAY'],
    ['Tambah konteks: kalimat & sumber tontonan', 'Add context: sentence & where you heard it'],
    ['Konteks kata ini', 'Context for this word'],
    ['Ditemukan di', 'Heard in'],
    ['Ubah konteks', 'Edit context'],
    ['Simpan', 'Save'],
    ['Konteks disimpan.', 'Context saved.'],
    ['Konteks dihapus.', 'Context removed.'],
    ['Bahasa diganti ke Bahasa Inggris.', 'Language switched to English.'],

    // ---- More vocab ----
    ['Tidak ada yang perlu diulang', 'Nothing to review'],
    ['Tidak ada yang perlu diulang.', 'Nothing to review.'],
    ['Perlu diulang hari ini.', 'Due for review today.'],
    ['Sudah hafal — tidak masuk jadwal ulang.', 'Mastered — no more reviews scheduled.'],
    ['Belum ada kata. Coba ketik kata yang barusan kamu dengar, misalnya', 'No words yet. Try typing a word you just heard, for example'],

    // ---- Admin (long descriptions) ----
    ['Pusat konfigurasi API Key, pengelola database Supabase, dan manajemen user sistem.', 'Configure API keys, manage the Supabase database and system users.'],
    ['Akses Terbatas — Khusus Admin', 'Restricted — Admins Only'],
    ['Halaman Admin Console ini hanya dapat diakses oleh user dengan role', 'This Admin Console can only be opened by users with the role'],
    ['untuk menjaga keamanan API Keys dan Cloud Database.', 'to keep API keys and the cloud database safe.'],
    ['Atur kredensial Supabase Cloud dan API Key Gemini AI di sini. Data ini akan disinkronkan secara otomatis untuk seluruh aplikasi.', 'Set the Supabase Cloud credentials and the Gemini AI API key here. They are synced automatically across the app.'],
    ['Kelola daftar user terdaftar dan ubah role akses (User / Admin).', 'Manage registered users and change their access role (User / Admin).'],
    ['Gunakan opsi ini jika ingin mereset cache lokal browser atau mengembalikan data sampel awal.', "Use these to reset the browser's local cache or bring back the original sample data."],

    // ---- Form placeholders ----
    ['Pisahkan dengan koma, mis. Rencana liburan, Studio baru', 'Comma-separated, e.g. Upcoming trip, New studio', 'Pisahkan dengan koma, e.g. Upcoming trip, New studio'],
    ['Pisahkan dengan koma, mis. Mantan, Drama kantor', 'Comma-separated, e.g. Ex-partner, Work drama', 'Pisahkan dengan koma, e.g. Ex-partner, Work drama'],
    ['Apa saja hal menarik atau kabar penting yang dibicarakan?', 'What interesting things or important news did you talk about?'],
    ['mis. Catatan Refleksi Sore Ini', 'e.g. Evening reflection', 'e.g. Catatan Refleksi Sore Ini'],
    ['Apa saja cerita, perasaan, atau kejadian menarik hari ini?', 'What stories, feelings or interesting things happened today?'],
    ['mis. Cuaca cerah, secangkir kopi hangat, kabar dari teman', 'e.g. Sunny weather, a warm cup of coffee, a message from a friend', 'e.g. Cuaca cerah, secangkir kopi hangat, kabar dari teman'],
    ['mis. Terbang di Atas Kota Kaca & Bertemu Kucing Bicara', 'e.g. Flying over a glass city & meeting a talking cat', 'e.g. Terbang di Atas Kota Kaca & Bertemu Kucing Bicara'],
    ['mis. Ethan, Kucing Putih, Teman SD', 'e.g. Ethan, a white cat, a primary school friend', 'e.g. Ethan, Kucing Putih, Teman SD'],
    ['Ceritakan bagaimana mimpimu bermula, suasana tempatnya, kejadian unik/aneh, dan momen saat kamu terbangun...', 'Describe how the dream started, where it took place, anything strange that happened, and the moment you woke up...'],
    ['mis. Bangun dengan perasaan penasaran dan agak lega', 'e.g. Woke up curious and a little relieved', 'e.g. Bangun dengan perasaan penasaran dan agak lega'],
    ['mis. Tanya Sophia tentang kucingnya Mochi, atau Tanyakan kabar Ethan tentang proyek barunya...', 'e.g. Ask Sophia about her cat Mochi, or ask Ethan how his new project is going...', 'e.g. Tanya Sophia tentang kucingnya Mochi, atau Tanyakan kabar Ethan tentang proyek barunya...'],
    ['mis. Wisuda S2 di UI, Perkiraan Hari Lahiran, Resepsi Nikah', "e.g. Master's graduation, Baby due date, Wedding reception", 'e.g. Wisuda S2 di UI, Perkiraan Hari Lahiran, Resepsi Nikah'],
    ['mis. Mau kirim buket bunga mawar, kasih kado perlengkapan bayi, atau telephon tepat jam 9 pagi...', 'e.g. Send a bouquet of roses, give baby supplies, or call at exactly 9 a.m....', 'e.g. Mau kirim buket bunga mawar, kasih kado perlengkapan bayi, atau telephon tepat jam 9 pagi...'],
    ['mis. Catchup Kopi & Diskusi Proyek', 'e.g. Coffee catch-up & project chat', 'e.g. Catchup Kopi & Diskusi Proyek'],
    ['mis. Es Oat Latte', 'e.g. Iced Oat Latte'],
    ['mis. Ramen Truffle', 'e.g. Truffle Ramen'],
    ['mis. Lavender & Sage', 'e.g. Lavender & Sage'],
    ['mis. Fotografi Film', 'e.g. Film Photography'],
    ['mis. Atomic Habits', 'e.g. Atomic Habits'],
    ['mis. Desain, Jepang, Kopi, Kafe Kucing', 'e.g. Design, Japan, Coffee, Cat Cafes'],
    ['mis. Ketumbar, Datang telat tanpa kabar', 'e.g. Cilantro, Late arrivals without text'],
    ['mis. Kamera Instax (Rp1,5jt), Mangkuk Keramik (Rp200rb)', 'e.g. Instax Camera ($199), Ceramic Bowl ($45)']
  ],

  // Strings with changing parts. {a}, {b} stand for the parts that are carried over.
  patternPairs: [
    ['Selamat pagi, {a}', 'Good morning, {a}'],
    ['Selamat siang, {a}', 'Good afternoon, {a}'],
    ['Selamat sore, {a}', 'Good evening, {a}'],
    ['Selamat malam, {a}', 'Good evening, {a}'],
    ['{n} hari lagi', 'in {n} days'],
    ['{n} hari', '{n} days'],
    ['Kamu mencatat {n} teman. Tidak ada acara dalam 30 hari ke depan.', "You're keeping track of {n} friends. No events in the next 30 days."],
    ['{a} sudah ditambahkan ke daftar teman.', '{a} has been added to your friend directory.'],
    ['Profil {a} berhasil diperbarui.', 'Profile {a} successfully updated.'],
    ['Profil {a} berhasil dihapus.', 'Profile {a} deleted.'],
    ['Selamat datang kembali, {a}!', 'Welcome back, {a}!'],
    ['Peran diganti ke mode {a}.', 'Switched role to {a} mode.'],
    ['Pengingat aktif untuk {a} ({b}).', 'Reminder set for {a} ({b}).'],
    ['{n} perubahan belum terkirim, dicoba lagi nanti.', "{n} changes haven't been sent yet; will retry later."],
    ['Catatan memory "{a}" berhasil diperbarui.', 'Memory note "{a}" updated.'],
    ['Cerita mimpi "{a}" berhasil diperbarui.', 'Dream "{a}" updated.'],
    ['Momen "{a}" berhasil diperbarui.', 'Moment "{a}" updated.'],
    ['Momen spesial "{a}" berhasil dicatat.', 'Special moment "{a}" saved.'],
    ['Maksudnya "{a}"? Kata itu sudah ada di daftarmu.', 'Did you mean "{a}"? That word is already in your list.'],
    ['"{a}" sekarang ditandai sudah hafal.', '"{a}" is now marked as mastered.'],
    ['Tidak ada hasil untuk "{a}".', 'No results for "{a}".'],
    ['Ulangi {n} kata', 'Review {n} words'],
    ['Ulangi kosakata ({n} hari ini)', 'Review vocab ({n} today)'],
    ['Tidak ada yang perlu diulang hari ini. Jadwal berikutnya: {a}.', 'Nothing to review today. Next review: {a}.'],
    ['Ulangan berikutnya besok.', 'Next review tomorrow.'],
    ['Ulangan berikutnya besok · sudah diulang {n}×.', 'Next review tomorrow · reviewed {n}×.'],
    ['Ulangan berikutnya {n} hari lagi.', 'Next review in {n} days.'],
    ['Ulangan berikutnya {n} hari lagi · sudah diulang {m}×.', 'Next review in {n} days · reviewed {m}×.'],
    ['{n} bulan', '{n} months'],
    ['Profil {a} berhasil diperbarui!', 'Profile {a} successfully updated!']
  ],

  init() {
    try { this.lang = localStorage.getItem(this.storageKey) === 'en' ? 'en' : 'id'; } catch (e) { this.lang = 'id'; }
    this.build();
    document.documentElement.lang = this.lang;
    const start = () => {
      this.translateTree(document.body);
      this.observe();
      this.syncControls();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  },

  build() {
    const norm = s => s.replace(/\s+/g, ' ').trim();
    this.toEn = new Map();
    this.toId = new Map();
    // [id, en, ...aliases]: aliases are older mixed-language labels still in the markup
    this.pairs.forEach(([id, en, ...aliases]) => {
      id = norm(id); en = norm(en);
      if (!this.toEn.has(id)) this.toEn.set(id, en);
      if (!this.toId.has(en)) this.toId.set(en, id);
      aliases.forEach(a => {
        a = norm(a);
        if (!this.toEn.has(a)) this.toEn.set(a, en);
        if (!this.toId.has(a)) this.toId.set(a, id);
      });
    });
    const compile = (tpl) => {
      const names = [];
      const src = tpl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{([a-z])\\\}/g, (_, n) => { names.push(n); return (n === 'n' || n === 'm') ? '([0-9]+)' : '(.+?)'; });
      return { re: new RegExp('^' + src + '$'), names };
    };
    this.patterns = this.patternPairs.map(([id, en]) => ({ id, en, idRe: compile(id), enRe: compile(en) }));
  },

  // Translate one string into the current language; returns null when there's nothing to change
  translate(text) {
    const key = text.replace(/\s+/g, ' ').trim();
    if (!key || !/[A-Za-z]/.test(key)) return null;
    const map = this.lang === 'en' ? this.toEn : this.toId;
    if (map.has(key)) return map.get(key);
    for (const p of this.patterns) {
      const from = this.lang === 'en' ? p.idRe : p.enRe;
      const to = this.lang === 'en' ? p.en : p.id;
      const m = key.match(from.re);
      if (m) {
        let out = to;
        from.names.forEach((n, i) => {
          const part = this.translate(m[i + 1]) ?? m[i + 1]; // e.g. relation names inside a sentence
          out = out.replace(`{${n}}`, part);
        });
        return out;
      }
    }
    return null;
  },

  // Public helper for code that builds strings itself
  t(text) {
    return this.translate(text) ?? text;
  },

  locale() {
    return this.lang === 'en' ? 'en-US' : 'id-ID';
  },

  skip(el) {
    if (!el) return true;
    if (/^(SCRIPT|STYLE|TEXTAREA|CODE|PRE|NOSCRIPT)$/.test(el.tagName)) return true;
    return !!el.closest('[data-no-i18n]');
  },

  translateTextNode(node) {
    const value = node.nodeValue;
    if (!value || !value.trim() || this.skip(node.parentElement)) return;
    const out = this.translate(value);
    if (out === null) return;
    const lead = value.match(/^\s*/)[0];
    const trail = value.match(/\s*$/)[0];
    const next = lead + out + trail;
    if (next !== value) node.nodeValue = next;
  },

  translateAttrs(el) {
    // Placeholders on textareas/inputs are UI text, so only data-no-i18n opts out here
    if (!el || el.closest('[data-no-i18n]')) return;
    ['placeholder', 'title', 'aria-label'].forEach(attr => {
      const value = el.getAttribute(attr);
      if (!value) return;
      const out = this.translate(value);
      if (out !== null && out !== value) el.setAttribute(attr, out);
    });
  },

  translateTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) { this.translateTextNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    this.translateAttrs(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) this.translateTextNode(node);
      else this.translateAttrs(node);
    }
  },

  observe() {
    if (this.observer) return;
    this.observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'characterData') this.translateTextNode(m.target);
        else if (m.type === 'attributes') this.translateAttrs(m.target);
        else m.addedNodes.forEach(n => this.translateTree(n));
      }
    });
    this.observer.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label']
    });
  },

  setLang(lang) {
    lang = lang === 'en' ? 'en' : 'id';
    if (lang === this.lang) return;
    this.lang = lang;
    try { localStorage.setItem(this.storageKey, lang); } catch (e) {}
    document.documentElement.lang = lang;
    this.translateTree(document.body);
    this.syncControls();
    window.dispatchEvent(new CustomEvent('mindvault:language', { detail: { lang } }));
  },

  syncControls() {
    document.querySelectorAll('[data-lang-option]').forEach(btn => {
      const on = btn.getAttribute('data-lang-option') === this.lang;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const select = document.getElementById('user-setting-language');
    if (select) select.value = this.lang;
  }
};

I18N.init();
