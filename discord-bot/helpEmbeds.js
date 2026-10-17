const { EmbedBuilder } = require('discord.js');

const BOT_FOOTER = 'Dibuat & Dikembangkan oleh kicenzeus 🔥 • Jarvis / Amba Bot';

/**
 * Embed Panduan Lengkap (All-in-One)
 */
function getMainHelpEmbed() {
    return new EmbedBuilder()
        .setColor(0x00F0FF) // Cyberpunk Cyan
        .setTitle('⚡ PANDUAN PENGGUNAAN AMBA / JARVIS BOT ⚡')
        .setDescription(
            'Halo Bos! Gua **Amba** (Jarvis), asisten pribadi pintar sekaligus pemutar musik berkualitas tinggi di Discord.\n' +
            'Berikut panduan lengkap fitur yang bisa Bos gunakan. Pilih kategori yang Bos butuhkan atau gunakan menu khusus:'
        )
        .addFields(
            {
                name: '🎵 PEMUTAR MUSIK HD (`!help music`)',
                value:
                    '• `!p <judul / link>` : Putar lagu dari **YouTube**, **Spotify**, atau **SoundCloud**.\n' +
                    '• `!pause` : Jeda pemutaran lagu sementara.\n' +
                    '• `!resume` / `!unpause` : Lanjutkan kembali lagu yang dijeda.\n' +
                    '• `!s` / `!skip` : Lewati lagu yang sedang berputar ke lagu berikutnya.\n' +
                    '• `!q` / `!queue` : Tampilkan daftar antrean lagu.\n' +
                    '• `!v <1-100>` : Atur volume pemutaran musik (contoh: `!v 75`).\n' +
                    '• `!stop` : Berhentikan musik dan bersihkan seluruh antrean.\n' +
                    '✨ *Harmonisasi Pintar:* Musik otomatis dijeda saat Bos ngobrol di Voice Channel!',
                inline: false,
            },
            {
                name: '🧠 PERSONAL AI ASSISTANT (`!help assistant`)',
                value:
                    '• **Pengingat / Reminder:** `amba ingetin gw jam 13.00 makan siang`\n' +
                    '• **Manajemen Tugas:** `amba catat tugas revisi presentasi prioritas tinggi`\n' +
                    '• **Cek Tugas:** `amba tugas gue hari ini apa aja?`\n' +
                    '• **Catatan Keuangan:** `amba catat pengeluaran 25rb buat sarapan`\n' +
                    '• **Rekap Keuangan:** `amba berapa total pengeluaran gue minggu ini?`\n' +
                    '• **Simpan Catatan:** `amba simpan catatan akun wifi: user1 / pass123`\n' +
                    '• **Gaya Panggilan:** `amba panggil gw Bos / Komandan / Bro`',
                inline: false,
            },
            {
                name: '🎙️ OBROLAN SUARA & VOICE CHANNEL',
                value:
                    '• `!join` / `amba join vc` : Amba masuk ke Voice Channel Bos.\n' +
                    '• `!leave` / `amba leave vc` : Amba pamit keluar dari Voice Channel.\n' +
                    '• **Voice Note (VN):** Kirim VN di chat atau minta balasan suara (`amba balas pake vn`).\n' +
                    '• **Ngobrol Langsung:** Cukup sebut *"Halo Amba"* saat di Voice Channel untuk ngobrol langsung!',
                inline: false,
            },
            {
                name: '💡 TIPS PINTAR',
                value:
                    '• Di Text Channel publik, selalu sertakan kata **amba** atau awalan tanda seru (`!p`, `!s`, dll) agar Amba merespons.\n' +
                    '• Untuk panduan lebih spesifik: ketik `!help music` atau `!help assistant`.',
                inline: false,
            }
        )
        .setFooter({ text: BOT_FOOTER })
        .setTimestamp();
}

/**
 * Embed Khusus Panduan Pemutar Musik
 */
function getMusicHelpEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2) // Discord Blurple
        .setTitle('🎶 PANDUAN LENGKAP PEMUTAR MUSIK 🎶')
        .setDescription(
            'Nikmati streaming musik jernih tanpa jeda di Voice Channel bersama Amba. ' +
            'Mendukung link langsung serta pencarian otomatis berbasis judul!'
        )
        .addFields(
            {
                name: '▶️ Memutar Musik',
                value:
                    '• `!p <judul lagu>` — Contoh: `!p Sheila on 7 Dan`\n' +
                    '• `!p <link youtube>` — Contoh: `!p https://youtu.be/...`\n' +
                    '• `!p <link spotify>` — Contoh: `!p https://open.spotify.com/track/...`\n' +
                    '• `!p <link soundcloud>` — Contoh: `!p https://soundcloud.com/...`\n' +
                    '• *Bisa juga panggil santai:* `amba putar lagu lofi hip hop`',
                inline: false,
            },
            {
                name: '🎛️ Kontrol Pemutaran & Antrean',
                value:
                    '• `!pause` : Menjeda musik.\n' +
                    '• `!resume` / `!unpause` : Melanjutkan musik.\n' +
                    '• `!s` / `!skip` : Melewati lagu ke daftar antrean berikutnya.\n' +
                    '• `!q` / `!queue` : Melihat daftar antrean lagu yang akan diputar.\n' +
                    '• `!v <angka>` / `!vol <angka>` : Mengatur volume (skala 1 - 100%, default 100%).\n' +
                    '• `!stop` : Menghentikan lagu dan mengosongkan antrean.',
                inline: false,
            },
            {
                name: '🎧 Kontrol Voice Channel',
                value:
                    '• `!join` : Mengajak Amba bergabung ke Voice Channel Anda.\n' +
                    '• `!leave` : Mengeluarkan Amba dari Voice Channel.',
                inline: false,
            },
            {
                name: '✨ Harmonisasi Suara Cerdas',
                value:
                    'Saat musik sedang diputar dan Bos berbicara/bertanya kepada Amba di Voice Channel, ' +
                    'musik akan **otomatis dijeda sementara**, dan **otomatis berputar kembali** setelah Amba selesai menjawab!',
                inline: false,
            }
        )
        .setFooter({ text: BOT_FOOTER })
        .setTimestamp();
}

/**
 * Embed Khusus Panduan Personal Assistant
 */
function getAssistantHelpEmbed() {
    return new EmbedBuilder()
        .setColor(0x57F287) // Emerald Green
        .setTitle('🧠 PANDUAN LENGKAP PERSONAL AI ASSISTANT 🧠')
        .setDescription(
            'Amba dibekali otak AI Google Gemini yang terhubung ke database PostgreSQL Jarvis pribadi Bos. ' +
            'Semua data aman, terisolasi, dan selalu siap sedia.'
        )
        .addFields(
            {
                name: '⏰ Pengingat Cerdas (Reminders)',
                value:
                    '• `amba ingetin gw jam 13.00 makan siang`\n' +
                    '• `amba besok jam 08.30 ingetin meeting mingguan`\n' +
                    '• `amba 10 menit lagi ingetin angkat jemuran`\n' +
                    '• *Notifikasi otomatis dikirim saat waktu tiba!*',
                inline: false,
            },
            {
                name: '📋 Manajemen Tugas & Todo',
                value:
                    '• `amba catat tugas bikin laporan keuangan prioritas tinggi`\n' +
                    '• `amba apa aja tugas gue yang belum selesai?`\n' +
                    '• `amba tandai tugas laporan keuangan sudah selesai`',
                inline: false,
            },
            {
                name: '💰 Pencatatan Keuangan Pribadi',
                value:
                    '• `amba catat pengeluaran 50rb makan siang padang`\n' +
                    '• `amba catat pemasukan 2jt freelance web`\n' +
                    '• `amba berapa total pengeluaran gue bulan ini?`',
                inline: false,
            },
            {
                name: '📝 Catatan Cepat (Notes)',
                value:
                    '• `amba simpan catatan ukuran sepatu gue 42`\n' +
                    '• `amba catatan gue tentang ide bisnis apa aja?`',
                inline: false,
            },
            {
                name: '🎙️ Interaksi Multi-Modal (Voice Note & VC)',
                value:
                    '• **Kirim Pesan Suara:** Amba otomatis paham isi rekaman suara Bos!\n' +
                    '• **Pilih Format Balasan:** Minta balasan teks (`balas lewat chat aja`), suara (`balas pake vn`), atau keduanya (`balas teks dan vn`).\n' +
                    '• **Ngobrol Langsung:** Masuk ke Voice Channel lalu sapa *"Halo Amba"*.',
                inline: false,
            },
            {
                name: '⚙️ Personalisasi Profil',
                value:
                    '• Atur nama panggilan favorit: `amba mulai sekarang panggil gue Komandan` / `Bos` / `Kapten`.\n' +
                    '• Atur format pesan reminder: `amba kalau ngingetin pake gaya: Bos waktunya ... ya!`',
                inline: false,
            },
            {
                name: '🌅 Asisten Proaktif (Phase 3)',
                value:
                    '• `!briefing` / `amba briefing` : Rangkuman agenda tugas & pengingat pagi hari.\n' +
                    '• `!recap` / `amba recap` : Rekapitulasi tugas selesai & pengeluaran malam hari.\n' +
                    '• `!snooze <menit>` : Menunda reminder yang baru saja berbunyi (contoh: `!snooze 15`).\n' +
                    '• Pengingat Berulang: `amba setiap Senin jam 8 ingetin olahraga`.\n' +
                    '• Otomatisasi: `amba aktifkan briefing pagi` / `amba matikan recap`.',
                inline: false,
            },
            {
                name: '🌐 Web Intelligence Real-Time (Phase 5)',
                value:
                    '• **Percakapan Alami (Tanpa Command):**\n' +
                    '  - Tanya Cuaca: `"amba gimana cuaca di Surabaya hari ini?"` / `"lagi hujan ga di Bandung?"`\n' +
                    '  - Cari Info Web: `"amba coba cariin harga iPhone 16"` / `"coba carikan resep rendang sapi"`\n' +
                    '  - Ekstraksi URL: Kirim link artikel: `"amba baca web ini dong https://..."`\n' +
                    '  - *Berlaku otomatis juga saat mengobrol via mikrofon di Voice Channel!*\n' +
                    '• **Shortcut Embed Cepat:** `!cuaca <kota>` | `!search <query>` | `!baca <link>`',
                inline: false,
            },
            {
                name: '📊 Personal Analytics & Insights (Phase 6)',
                value:
                    '• **Dashboard Komprehensif:** `!analytics` / `!analisis` / `!stats` / `amba analisis`\n' +
                    '• **Analisis Khusus:** `!analytics finance` (Keuangan) | `!analytics task` (Tugas)\n' +
                    '• **Filter Periode:** `!analytics week` (Minggu Ini) | `!analytics month` (Bulan Ini)\n' +
                    '• **Percakapan Alami:** `"amba analisis keuangan gue bulan ini"` / `"pengeluaran gue paling banyak buat apa?"` / `"gimana performa tugas gue?"`',
                inline: false,
            },
            {
                name: '🛡️ Keamanan & Akses Pengguna (Phase 7)',
                value:
                    '• **Cek Role Sendiri:** `!myrole` / `!role my` / `"amba role gue apa?"`\n' +
                    '• **Inspeksi Role User:** `!role check @user` *(Admin/Owner)*\n' +
                    '• **Daftar Role Khusus:** `!role list` *(Admin/Owner)*\n' +
                    '• **Atur Role User:** `!role set @user <OWNER/ADMIN/USER/GUEST/BLOCKED>` *(Owner only)*\n' +
                    '• **Inspeksi Audit Keamanan:** `!audit` / `!audit [limit]` *(Admin/Owner)*\n' +
                    '• **Status Keamanan Sistem:** `!security` / `!safety`',
                inline: false,
            },
            {
                name: '🩺 Keandalan, Diagnostik & Observabilitas (Phase 8)',
                value:
                    '• **Cek Latensi & Kesehatan Sistem:** `!ping` / `!health` / `!status`\n' +
                    '• **Diagnostik Lengkap:** Memeriksa latensi Discord WS, PostgreSQL, n8n Gateway, konsumsi RAM, dan uptime bot.\n' +
                    '• **HTTP Health Check:** Endpoint `GET /health` aktif di port 5001 untuk monitoring Docker container.',
                inline: false,
            }
        )
        .setFooter({ text: BOT_FOOTER })
        .setTimestamp();
}

/**
 * Embed Daftar Memori Aktif Pengguna (Phase 1)
 */
function getMemoriesEmbed(displayName, memories = []) {
    const embed = new EmbedBuilder()
        .setColor(0xFEE75C) // Warm Gold
        .setTitle(`🧠 MEMORI & INGATAN AMBA TENTANG ${displayName.toUpperCase()}`)
        .setFooter({ text: BOT_FOOTER })
        .setTimestamp();

    if (!memories || memories.length === 0) {
        embed.setDescription(
            `Amba belum memiliki catatan memori tersimpan tentang Bos.\n\n` +
            `💡 **Cara menyimpan memori baru:**\n` +
            `• *"amba ingat ya gue suka kopi hitam tanpa gula"*\n` +
            `• *"amba ingat nomor sepatu gue 42"*\n` +
            `• *"amba ingat gue alergi udang dan kepiting"*`
        );
        return embed;
    }

    embed.setDescription(
        `Berikut adalah hal-hal penting dan preferensi yang selalu Amba ingat tentang Bos:\n` +
        `*(Ketik \`!forget <kunci/topik>\` jika ingin Amba melupakan informasi tertentu)*\n`
    );

    // Grouping per category/type jika ada
    const typeIcons = {
        PROFILE: '👤',
        PREFERENCE: '⭐',
        PROJECT: '💼',
        HABIT: '🔄',
        CONTEXT: '📌',
        OTHER: '📝',
    };

    memories.forEach((m, idx) => {
        const icon = typeIcons[m.type] || '📌';
        embed.addFields({
            name: `${icon} ${m.key.toUpperCase()} (Tingkat Penting: ${'★'.repeat(m.importance || 3)})`,
            value: `**Nilai:** ${m.value}\n*Tipe:* \`${m.type}\``,
            inline: false,
        });
    });

    return embed;
}

/**
 * Embed Pengaturan Suara & Kepribadian Audio (Phase 4)
 */
function getVoiceSettingsEmbed(pref, displayName = 'Bos') {
    const voiceNames = {
        'id-ID-ArdiNeural': 'Ardi (Pria Indonesia, Santai & Hangat)',
        'id-ID-GadisNeural': 'Gadis (Wanita Indonesia, Lembut & Ramah)',
        'en-US-GuyNeural': 'Guy (English Male, Casual & Confident)',
        'en-US-JennyNeural': 'Jenny (English Female, Clear & Professional)',
    };

    const currentVoiceName = voiceNames[pref.voice_id] || pref.voice_id;

    return new EmbedBuilder()
        .setColor(0x9B59B6) // Amethyst Purple
        .setTitle(`🎙️ PENGATURAN SUARA & AUDIO ${displayName.toUpperCase()}`)
        .setDescription(
            `Sesuaikan karakter suara, kecepatan bicara, dan gaya respons audio Amba di Voice Channel maupun Voice Note.`
        )
        .addFields(
            {
                name: '🔊 Suara Aktif Saat Ini',
                value: `**${currentVoiceName}**\nBahasa: \`${pref.language || 'id-ID'}\``,
                inline: true,
            },
            {
                name: '⚡ Kecepatan Bicara',
                value: `**${pref.speed || '+0%'}** *(Default: Normal)*`,
                inline: true,
            },
            {
                name: '💬 Gaya Respons AI',
                value: `**${pref.style || 'CASUAL'}** *(Opsi: CASUAL / SHORT / DETAILED)*`,
                inline: true,
            },
            {
                name: '🎭 Pilihan Karakter Suara',
                value:
                    '• `!voice set ardi` — Suara pria Indonesia santai & hangat *(Default)*.\n' +
                    '• `!voice set gadis` — Suara wanita Indonesia lembut & bersahabat.\n' +
                    '• `!voice set guy` — Suara pria bahasa Inggris santai & percaya diri.\n' +
                    '• `!voice set jenny` — Suara wanita bahasa Inggris profesional.',
                inline: false,
            },
            {
                name: '⚙️ Perintah Pengaturan Lainnya',
                value:
                    '• `!voice speed <normal / cepat / lambat>` — Atur kecepatan bicara.\n' +
                    '• `!voice style <santai / singkat / detail>` — Atur panjang balasan AI.\n' +
                    '• *Interupsi Suara:* Katakan *"Stop"* atau ketik `!diam` saat Amba sedang berbicara di VC!',
                inline: false,
            }
        )
        .setFooter({ text: BOT_FOOTER })
        .setTimestamp();
}

/**
 * Embed Hasil Pencarian Web (Web Intelligence)
 */
function getWebSearchEmbed(query, results = []) {
    const embed = new EmbedBuilder()
        .setColor(0x00A8FF) // Electric Blue
        .setTitle('🌐 HASIL PENCARIAN WEB')
        .setDescription(`Hasil penelusuran informasi untuk: **"${query}"**\n`)
        .setFooter({ text: 'Jarvis Web Intelligence • kicenzeus' })
        .setTimestamp();

    if (!results || results.length === 0) {
        embed.addFields({
            name: 'Pencarian Kosong',
            value: 'Tidak ditemukan informasi relevan untuk kata kunci tersebut.',
        });
        return embed;
    }

    results.forEach((item, index) => {
        const titleLink = `[${item.title || 'Kunjungi Tautan'}](${item.url})`;
        const snippetText = item.snippet ? item.snippet.substring(0, 220) : 'Tidak ada deskripsi singkat.';
        embed.addFields({
            name: `${index + 1}. ${item.title.substring(0, 60)}`,
            value: `🔗 **Tautan:** ${titleLink}\n📄 *${snippetText}*`,
            inline: false,
        });
    });

    return embed;
}

/**
 * Embed Cuaca Real-Time (Open-Meteo)
 */
function getWeatherEmbed(weather) {
    return new EmbedBuilder()
        .setColor(0x3498DB) // Sky Blue
        .setTitle(`🌤️ INFO CUACA — ${weather.city.toUpperCase()}, ${weather.country.toUpperCase()}`)
        .setDescription(
            `Kondisi cuaca terkini di wilayah **${weather.region ? weather.region + ', ' : ''}${weather.city}**:`
        )
        .addFields(
            {
                name: '⛅ Kondisi Langit',
                value: `**${weather.weatherDescription}**`,
                inline: true,
            },
            {
                name: '🌡️ Temperatur',
                value: `**${weather.temperature}°C**\n*(Terasa: ${weather.feelsLike}°C)*`,
                inline: true,
            },
            {
                name: '💧 Kelembapan',
                value: `**${weather.humidity}%**`,
                inline: true,
            },
            {
                name: '💨 Kecepatan Angin',
                value: `**${weather.windSpeed} km/jam**`,
                inline: true,
            },
            {
                name: '🌧️ Curah Hujan',
                value: `**${weather.precipitation} mm**`,
                inline: true,
            },
            {
                name: '📍 Koordinat Lokasi',
                value: `\`${weather.latitude.toFixed(2)}, ${weather.longitude.toFixed(2)}\``,
                inline: true,
            }
        )
        .setFooter({ text: 'Open-Meteo Forecast • Jarvis Web Intelligence • kicenzeus' })
        .setTimestamp();
}

/**
 * Embed Dashboard Analitik Personal Komprehensif (Phase 6)
 */
function getAnalyticsDashboardEmbed(displayName, report) {
    const { finance, tasks, reminders, performance, label } = report;

    const embed = new EmbedBuilder()
        .setColor(0x8B5CF6) // Royal Purple / Cybernetic Violet
        .setTitle(`📊 EXECUTIVE ANALYTICS DASHBOARD — ${displayName.toUpperCase()}`)
        .setDescription(
            `Ringkasan performa produktivitas, kesehatan finansial, dan kedisiplinan agenda Bos (**${label}**):`
        )
        .addFields(
            {
                name: `🏆 Skor Produktivitas Jarvis: ${performance.score}/100 (Grade ${performance.grade})`,
                value: `\`${performance.progressBar}\`\n*Dihitung otomatis dari tingkat penyelesaian tugas, stabilitas kas, dan keandalan agenda.*`,
                inline: false,
            },
            {
                name: '📋 Performa Tugas (Tasks)',
                value:
                    `• **Selesai:** ${tasks.completed} dari ${tasks.totalCreated} tugas (${tasks.completionRate}%)\n` +
                    `• **Progress:** \`${tasks.progressBar}\`\n` +
                    `• **Status:** ${tasks.pending} pending | ${tasks.inProgress} dikerjakan\n` +
                    `• **Overdue:** ${tasks.overdue > 0 ? `⚠️ **${tasks.overdue} terlewat!**` : '✅ 0 (Aman)'}`,
                inline: true,
            },
            {
                name: '💰 Arus Kas & Keuangan',
                value:
                    `• **Pengeluaran:** ${finance.formattedExpense} ${finance.expenseChangePercent !== null ? `(*${finance.expenseChangePercent >= 0 ? '+' : ''}${finance.expenseChangePercent}%*)` : ''}\n` +
                    `• **Pemasukan:** ${finance.formattedIncome}\n` +
                    `• **Saldo Kas:** **${finance.formattedNetBalance}**\n` +
                    `• **Pos Terbesar:** ${finance.categories[0] ? `**${finance.categories[0].category}** (${finance.categories[0].percentage}%)` : '-'}\n` +
                    `• **Total Transaksi:** ${finance.transactionCount} catatan`,
                inline: true,
            },
            {
                name: '⏰ Aktivitas Pengingat (Reminders)',
                value:
                    `• **Total Terjadwal:** ${reminders.total} pengingat\n` +
                    `• **Terkirim:** ${reminders.sent} | **Menunggu:** ${reminders.pending}\n` +
                    `• **Ditunda (Snoozed):** ${reminders.snoozed} kali | **Rutin:** ${reminders.recurring}\n` +
                    `• **Ketepatan Waktu:** **${reminders.reliabilityRate}%**`,
                inline: false,
            }
        );

    // Kategori Pengeluaran Teratas
    if (finance.categories.length > 0) {
        const catLines = finance.categories.slice(0, 4).map((c, idx) => {
            return `${idx + 1}. **${c.category}**: ${c.formattedTotal} (*${c.percentage}%*) — \`${c.count} trx\``;
        }).join('\n');
        embed.addFields({
            name: '🏷️ Rincian Kategori Pengeluaran',
            value: catLines,
            inline: false,
        });
    }

    // Rekomendasi Cerdas / Proactive Insights
    if (performance.insights && performance.insights.length > 0) {
        embed.addFields({
            name: '💡 Wawasan Cerdas & Rekomendasi Jarvis',
            value: performance.insights.join('\n\n'),
            inline: false,
        });
    }

    embed.setFooter({ text: 'Jarvis Personal Analytics • Phase 6 • Dibuat oleh kicenzeus' })
        .setTimestamp();

    return embed;
}

/**
 * Embed Analitik Finansial Khusus
 */
function getFinanceAnalyticsEmbed(displayName, finance) {
    const embed = new EmbedBuilder()
        .setColor(0x10B981) // Emerald Green
        .setTitle(`💰 ANALITIK FINANSIAL PRIBADI — ${displayName.toUpperCase()}`)
        .setDescription(`Rincian data pengeluaran dan pemasukan Bos periode **${finance.label}**:`)
        .addFields(
            {
                name: '📊 Arus Kas (Cash Flow)',
                value:
                    `• **Total Pengeluaran:** **${finance.formattedExpense}**\n` +
                    `• **Total Pemasukan:** **${finance.formattedIncome}**\n` +
                    `• **Saldo Bersih (Net):** **${finance.formattedNetBalance}** ${finance.netBalance >= 0 ? '🟢 (Surplus)' : '🔴 (Defisit)'}\n` +
                    `• **Jumlah Transaksi:** ${finance.transactionCount} transaksi`,
                inline: false,
            }
        );

    if (finance.expenseChangePercent !== null) {
        embed.addFields({
            name: '📈 Perbandingan dengan Periode Lalu',
            value: `Pengeluaran mengalami perubahan sebesar **${finance.expenseChangePercent >= 0 ? '+' : ''}${finance.expenseChangePercent}%** dibanding periode sebelumnya.`,
            inline: false,
        });
    }

    if (finance.categories.length > 0) {
        const catLines = finance.categories.map((c, i) => `${i + 1}. **${c.category}**: ${c.formattedTotal} (*${c.percentage}%*)`).join('\n');
        embed.addFields({
            name: '🏷️ Breakdown per Kategori',
            value: catLines,
            inline: false,
        });
    }

    if (finance.largestExpense) {
        embed.addFields({
            name: '💸 Pengeluaran Tunggal Terbesar',
            value: `**${finance.largestExpense.formattedAmount}** untuk *"${finance.largestExpense.description}"* (Kategori: ${finance.largestExpense.category})`,
            inline: false,
        });
    }

    embed.setFooter({ text: 'Jarvis Finance Intelligence • Phase 6 • kicenzeus' })
        .setTimestamp();

    return embed;
}

/**
 * Embed Analitik Tugas Khusus
 */
function getTaskAnalyticsEmbed(displayName, tasks) {
    const embed = new EmbedBuilder()
        .setColor(0x3B82F6) // Blue
        .setTitle(`📋 ANALITIK PRODUKTIVITAS TUGAS — ${displayName.toUpperCase()}`)
        .setDescription(`Ringkasan performa manajemen tugas Bos periode **${tasks.label}**:`)
        .addFields(
            {
                name: '📈 Tingkat Penyelesaian (Completion Rate)',
                value: `\`${tasks.progressBar}\`\n**${tasks.completed}** tugas selesai dari total **${tasks.totalCreated}** tugas yang dibuat.`,
                inline: false,
            },
            {
                name: '📊 Rincian Status',
                value:
                    `• **Selesai:** ${tasks.completed}\n` +
                    `• **Sedang Dikerjakan:** ${tasks.inProgress}\n` +
                    `• **Menunggu (Pending):** ${tasks.pending}\n` +
                    `• **Overdue:** ${tasks.overdue > 0 ? `⚠️ **${tasks.overdue} tugas**` : '0 (Tepat Waktu)'}`,
                inline: true,
            },
            {
                name: '🔥 Tugas Prioritas Tinggi',
                value: `**${tasks.highPriorityCompleted}** / ${tasks.totalHighPriority} prioritas tinggi selesai.`,
                inline: true,
            }
        )
        .setFooter({ text: 'Jarvis Task Intelligence • Phase 6 • kicenzeus' })
        .setTimestamp();

    return embed;
}

/**
 * Embed Informasi Role Pengguna (Phase 7: RBAC)
 */
function getUserRoleEmbed(user, roleInfo, assignedBy = null, notes = null) {
    const embed = new EmbedBuilder()
        .setColor(roleInfo.color || 0x3B82F6)
        .setTitle(`🛡️ INFORMASI ROLE & HAK AKSES — ${(user.displayName || user.username || 'PENGGUNA').toUpperCase()}`)
        .setDescription(`Status akun dan tingkat perizinan Bos di sistem Jarvis V2:`)
        .addFields(
            {
                name: 'Tingkat Role (Level)',
                value: `**${roleInfo.badge}** *(Level ${roleInfo.level}/4)*`,
                inline: true,
            },
            {
                name: 'Discord User ID',
                value: `\`${user.id}\``,
                inline: true,
            },
            {
                name: 'Deskripsi Role',
                value: roleInfo.description,
                inline: false,
            }
        );

    // Kapabilitas berdasarkan role
    const capabilities = {
        OWNER: [
            '✅ Kontrol penuh sistem bot & n8n Gateway',
            '✅ Kelola & atur role user lain (`!role set`)',
            '✅ Akses penuh seluruh log audit keamanan (`!audit`)',
            '✅ Perintah berisiko tinggi & pembersihan database massal',
            '✅ Akses seluruh fitur personal assistant, AI, web, voice & musik',
        ],
        ADMIN: [
            '✅ Manajemen & inspeksi status user (`!role check`, `!role list`)',
            '✅ Akses inspeksi audit log keamanan (`!audit`)',
            '✅ Melihat statistik performa & stabilitas sistem',
            '✅ Akses seluruh fitur personal assistant, AI, web, voice & musik',
            '❌ Tidak dapat mengubah role menjadi OWNER / shutdown sistem',
        ],
        USER: [
            '✅ Manajemen tugas & todo list lengkap (`task.*`)',
            '✅ Sistem pengingat & briefing proaktif (`reminder.*`)',
            '✅ Pencatatan keuangan & ringkasan saldo (`finance.*`)',
            '✅ Memori preferensi jangka panjang (`memory.*`)',
            '✅ Analitik personal visual (`!analytics`)',
            '✅ Web Intelligence real-time (cuaca, search, ekstraksi)',
            '✅ Fitur suara (Voice Channel & Voice Note) serta musik',
        ],
        GUEST: [
            '✅ Percakapan santai dengan AI (Read-Only)',
            '✅ Pencarian web & informasi cuaca umum',
            '✅ Mendengar di Voice Channel',
            '⚠️ Catatan keuangan, tugas, dan memori pribadi dinonaktifkan',
        ],
        BLOCKED: [
            '🚫 Seluruh akses interaksi dengan bot telah diblokir',
        ],
    };

    embed.addFields({
        name: '📋 Hak Akses & Kapabilitas Utama',
        value: (capabilities[roleInfo.name] || []).join('\n') || 'Tidak ada kapabilitas.',
        inline: false,
    });

    if (assignedBy) {
        embed.addFields({
            name: 'Catatan Penugasan',
            value: `Ditugaskan oleh: **${assignedBy}**${notes ? `\nCatatan: *${notes}*` : ''}`,
            inline: false,
        });
    }

    embed.setFooter({ text: 'Jarvis RBAC Guard • Phase 7 • kicenzeus' }).setTimestamp();
    return embed;
}

/**
 * Embed Daftar Pengguna dengan Role Khusus (Phase 7)
 */
function getRoleListEmbed(privilegedUsers = []) {
    const embed = new EmbedBuilder()
        .setColor(0xF59E0B) // Gold
        .setTitle('👑 DAFTAR PENGGUNA DENGAN HAK AKSES KHUSUS')
        .setDescription('Daftar pengguna yang memiliki role istimewa (**OWNER**, **ADMIN**, atau **BLOCKED**) di Jarvis V2:')
        .setFooter({ text: 'Jarvis RBAC Guard • Phase 7 • kicenzeus' })
        .setTimestamp();

    if (!privilegedUsers || privilegedUsers.length === 0) {
        embed.addFields({
            name: 'Status',
            value: 'Belum ada pengguna khusus yang terdaftar.',
            inline: false,
        });
        return embed;
    }

    const roleBadges = {
        OWNER: '👑 OWNER',
        ADMIN: '🛡️ ADMIN',
        BLOCKED: '🚫 BLOCKED',
    };

    privilegedUsers.forEach((u) => {
        const badge = roleBadges[u.role] || u.role;
        const name = u.display_name ? `**${u.display_name}** (<@${u.discord_user_id}>)` : `<@${u.discord_user_id}>`;
        embed.addFields({
            name: `${badge} — ${u.discord_user_id}`,
            value:
                `• Pengguna: ${name}\n` +
                `• Ditugaskan oleh: \`${u.assigned_by || 'SYSTEM'}\`\n` +
                (u.notes ? `• Catatan: *${u.notes}*\n` : '') +
                `• Diperbarui: <t:${Math.floor(new Date(u.updated_at).getTime() / 1000)}:R>`,
            inline: false,
        });
    });

    return embed;
}

/**
 * Embed Inspeksi Audit Log Keamanan (Phase 7)
 */
function getAuditLogsEmbed(logs = [], filterRisk = null) {
    const embed = new EmbedBuilder()
        .setColor(0x6366F1) // Indigo
        .setTitle(`📜 AUDIT LOG KEAMANAN & AKSES SISTEM${filterRisk ? ` [${filterRisk.toUpperCase()}]` : ''}`)
        .setDescription(
            `Menampilkan **${logs.length}** jejak aktivitas keamanan dan eksekusi tool terbaru:`
        )
        .setFooter({ text: 'Jarvis Security & Audit • Phase 7 • kicenzeus' })
        .setTimestamp();

    if (!logs || logs.length === 0) {
        embed.addFields({
            name: 'Status',
            value: 'Belum ada catatan aktivitas keamanan yang terekam.',
            inline: false,
        });
        return embed;
    }

    const riskBadges = {
        LOW: '🟢 LOW',
        MEDIUM: '🟡 MED',
        HIGH: '🟠 HIGH',
        CRITICAL: '🔴 CRIT',
    };

    const statusIcons = {
        SUCCESS: '✅',
        BLOCKED: '🚫',
        FAILED: '❌',
        PENDING_CONFIRMATION: '⏳',
    };

    let logText = '';
    logs.slice(0, 10).forEach((l) => {
        const risk = riskBadges[l.risk_level] || l.risk_level;
        const icon = statusIcons[l.status] || '•';
        const time = `<t:${Math.floor(new Date(l.created_at).getTime() / 1000)}:R>`;
        const user = `<@${l.user_id}>`;
        logText += `${icon} \`[${risk}]\` **${l.action}** oleh ${user} (${l.status})\n└ Waktu: ${time}\n`;
    });

    embed.addFields({
        name: 'Jejak Aktivitas Terakhir',
        value: logText || 'Tidak ada log.',
        inline: false,
    });

    return embed;
}

/**
 * Embed Ringkasan Status Keamanan Sistem (Phase 7)
 */
function getSecurityStatusEmbed(stats = {}) {
    return new EmbedBuilder()
        .setColor(0x10B981) // Emerald
        .setTitle('🛡️ STATUS SISTEM KEAMANAN & RBAC JARVIS V2')
        .setDescription('Ringkasan proteksi, autentikasi, dan pengawasan audit aktif:')
        .addFields(
            {
                name: '🔐 RBAC Multi-Tier',
                value: 'Status: **AKTIF**\nLevel: `OWNER` > `ADMIN` > `USER` > `GUEST`',
                inline: true,
            },
            {
                name: '🧹 Credential Sanitizer',
                value: 'Status: **AKTIF**\nMeredaksi token, password, & API key secara otomatis.',
                inline: true,
            },
            {
                name: '⚡ High-Risk Guard',
                value: 'Status: **AKTIF**\nKonfirmasi 2 langkah untuk aksi destruktif/massal.',
                inline: true,
            },
            {
                name: '📊 Statistik Audit',
                value:
                    `• Total Log Terekam: **${stats.totalLogs || 0}** entri\n` +
                    `• Percobaan Akses Ditolak (Blocked): **${stats.blockedLogs || 0}**\n` +
                    `• Aksi Risiko Tinggi (High/Crit): **${stats.highRiskLogs || 0}**`,
                inline: false,
            },
            {
                name: '⚙️ Panduan Singkat Command',
                value:
                    '• `!myrole` — Cek status perizinan akun Bos\n' +
                    '• `!role list` — Tampilkan daftar Owner & Admin\n' +
                    '• `!role set @user <ROLE>` — Perbarui level akses (Owner Only)\n' +
                    '• `!audit` — Tinjau riwayat eksekusi & keamanan sistem',
                inline: false,
            }
        )
        .setFooter({ text: 'Jarvis Security Core • Phase 7 • kicenzeus' })
        .setTimestamp();
}

/**
 * Embed Diagnostik Kesehatan Sistem & Observabilitas (Phase 8)
 */
function getHealthStatusEmbed(data) {
    const isHealthy = data.overallStatus === 'HEALTHY';
    const isDegraded = data.overallStatus === 'DEGRADED';
    const color = isHealthy ? 0x10B981 : (isDegraded ? 0xF59E0B : 0xEF4444);
    const statusIcon = isHealthy ? '🟢' : (isDegraded ? '🟡' : '🔴');

    const db = data.database || {};
    const n8n = data.n8n || {};
    const sys = data.system || {};
    const metrics = data.metrics || {};
    const voice = data.voice || {};

    const dbLatencyText = db.status === 'UP' ? `🟢 UP (${db.latencyMs}ms)` : `🔴 DOWN (${db.error || 'Err'})`;
    const n8nLatencyText = n8n.status === 'UP' ? `🟢 UP (${n8n.latencyMs}ms)` : (n8n.status === 'DEGRADED' ? `🟡 DEGRADED (${n8n.latencyMs}ms)` : `🔴 DOWN (${n8n.error || 'Err'})`);
    const wsPingText = data.discordWsPing !== null ? `🟢 ${data.discordWsPing}ms` : '⚪ N/A';

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`🩺 DIAGNOSTIK KESEHATAN SISTEM — ${statusIcon} ${data.overallStatus}`)
        .setDescription(`Laporan observabilitas dan performa real-time seluruh modul Jarvis V2:`)
        .addFields(
            {
                name: '⚡ Latensi Layanan',
                value:
                    `• **Discord WebSocket:** ${wsPingText}\n` +
                    `• **PostgreSQL DB:** ${dbLatencyText}\n` +
                    `• **n8n Automation:** ${n8nLatencyText}`,
                inline: true,
            },
            {
                name: '💻 Resource & Memory RAM',
                value:
                    `• **RSS Memory:** ${sys.memoryMb?.rss || 0} MB\n` +
                    `• **Heap Digunakan:** ${sys.memoryMb?.heapUsed || 0} / ${sys.memoryMb?.heapTotal || 0} MB\n` +
                    `• **Node.js:** \`${sys.nodeVersion || process.version}\` (${sys.platform || ''})`,
                inline: true,
            },
            {
                name: '⏱️ Uptime & Operasional Bot',
                value:
                    `• **Bot Uptime:** **${metrics.uptimeFormatted || '0d'}**\n` +
                    `• **Total Pesan Diproses:** ${metrics.messagesProcessed || 0}\n` +
                    `• **Tingkat Sukses AI:** **${metrics.aiSuccessRatePercent || 100}%** (${metrics.aiSuccess || 0} sukses / ${metrics.aiFailures || 0} gagal)\n` +
                    `• **Rata-rata Respon AI:** ${metrics.avgLatencyMs || 0}ms`,
                inline: false,
            },
            {
                name: '🎙️ Voice Engine & Disk Cache',
                value:
                    `• **Status Voice Engine:** 🟢 UP\n` +
                    `• **File Audio Temp:** ${voice.tempAudioFiles || 0} file (${voice.tempDiskUsageMb || 0} MB)\n` +
                    `• **Total Voice Requests:** ${metrics.voiceRequests || 0}`,
                inline: true,
            },
            {
                name: '🛡️ Reliability & Resilience',
                value:
                    `• **Bounded Retry:** 🟢 Aktif (Maks 2x Backoff)\n` +
                    `• **Graceful Shutdown:** 🟢 Siap\n` +
                    `• **HTTP Health Check:** 🟢 Port 5001 aktif`,
                inline: true,
            }
        )
        .setFooter({ text: 'Jarvis Reliability & Observability • Phase 8 • kicenzeus' })
        .setTimestamp();

    return embed;
}

/**
 * Embed Daftar Jadwal & Agenda (Schedules)
 */
function getSchedulesEmbed(schedules, userName = 'Bos') {
    const embed = new EmbedBuilder()
        .setColor(0x3498DB) // Soft Blue
        .setTitle('📅 AGENDA & JADWAL KEGIATAN')
        .setDescription(
            `Berikut adalah daftar agenda acara, rapat, dan kegiatan terjadwal milik **${userName}**.\n` +
            `*Catat baru:* \`amba catat jadwal rapat besok jam 2 siang di Google Meet prioritas tinggi\``
        );

    if (!schedules || schedules.length === 0) {
        embed.addFields({
            name: 'ℹ️ Tidak Ada Jadwal Aktif',
            value: 'Belum ada agenda kegiatan yang tersimpan. Kamu bisa minta Amba untuk mencatat jadwal rapat, kuliah, atau acara lainnya!',
            inline: false,
        });
    } else {
        schedules.forEach((s, idx) => {
            const prio = (s.priority || 'MEDIUM').toUpperCase();
            const badge = prio === 'URGENT' ? '🔴 [URGENT]' : prio === 'HIGH' ? '🟠 [HIGH]' : prio === 'LOW' ? '🟢 [LOW]' : '🟡 [MED]';
            const startDate = new Date(s.start_time);
            const dateStr = new Intl.DateTimeFormat('id-ID', {
                timeZone: 'Asia/Jakarta',
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(startDate);

            let timeSpan = `${dateStr} WIB`;
            if (s.end_time) {
                const endStr = new Intl.DateTimeFormat('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                }).format(new Date(s.end_time));
                timeSpan += ` - ${endStr} WIB`;
            }

            const loc = s.location ? `\n📍 **Lokasi/Link:** ${s.location}` : '';
            const desc = s.description ? `\n💬 *${s.description}*` : '';

            embed.addFields({
                name: `${idx + 1}. ${badge} ${s.title}`,
                value: `⏰ **Waktu:** \`${timeSpan}\`${loc}${desc}`,
                inline: false,
            });
        });
    }

    embed.setFooter({ text: BOT_FOOTER }).setTimestamp();
    return embed;
}

/**
 * Embed Daftar Tugas (Tasks / To-Do List)
 */
function getTasksEmbed(tasks, userName = 'Bos') {
    const embed = new EmbedBuilder()
        .setColor(0x2ECC71) // Green
        .setTitle('📋 DAFTAR TUGAS & TO-DO LIST')
        .setDescription(
            `Berikut adalah daftar pekerjaan dan tugas yang harus diselesaikan oleh **${userName}**.\n` +
            `*Catat baru:* \`amba catat tugas bikin laporan keuangan prioritas urgent\``
        );

    if (!tasks || tasks.length === 0) {
        embed.addFields({
            name: '✨ Semua Beres!',
            value: 'Tidak ada tugas yang tertunda saat ini. Kerja bagus, atau santai sejenak! ☕',
            inline: false,
        });
    } else {
        tasks.forEach((t, idx) => {
            const prio = (t.priority || 'MEDIUM').toUpperCase();
            const badge = prio === 'URGENT' ? '🔴 [URGENT]' : prio === 'HIGH' ? '🟠 [HIGH]' : prio === 'LOW' ? '🟢 [LOW]' : '🟡 [MED]';
            const statusBadge = t.status === 'in_progress' ? '⏳ Sedang Dikerjakan' : '📋 Pending';
            let dueStr = '';
            if (t.due_at) {
                const dueDate = new Date(t.due_at);
                const dStr = new Intl.DateTimeFormat('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                }).format(dueDate);
                dueStr = `\n⏰ **Batas Waktu:** \`${dStr} WIB\``;
            }
            const desc = t.description ? `\n💬 *${t.description}*` : '';

            embed.addFields({
                name: `${idx + 1}. ${badge} ${t.title}`,
                value: `Status: **${statusBadge}**${dueStr}${desc}`,
                inline: false,
            });
        });
    }

    embed.setFooter({ text: BOT_FOOTER }).setTimestamp();
    return embed;
}

/**
 * Embed Daftar Pengingat (Reminders / Alarms)
 */
function getRemindersEmbed(reminders, userName = 'Bos') {
    const embed = new EmbedBuilder()
        .setColor(0xF1C40F) // Yellow / Gold
        .setTitle('⏰ DAFTAR PENGINGAT & ALARM AKTIF')
        .setDescription(
            `Berikut adalah alarm notifikasi proaktif yang akan mencolek **${userName}** saat waktu jatuh tempo.\n` +
            `*Pasang baru:* \`amba ingetin jam 13.00 makan siang prioritas tinggi\``
        );

    if (!reminders || reminders.length === 0) {
        embed.addFields({
            name: 'ℹ️ Tidak Ada Pengingat Aktif',
            value: 'Belum ada alarm pengingat aktif yang terjadwal. Kamu bisa minta Amba untuk mengingatkan kegiatan penting!',
            inline: false,
        });
    } else {
        reminders.forEach((r, idx) => {
            const prio = (r.priority || 'MEDIUM').toUpperCase();
            const badge = prio === 'URGENT' ? '🔴 [URGENT]' : prio === 'HIGH' ? '🟠 [HIGH]' : prio === 'LOW' ? '🟢 [LOW]' : '🟡 [MED]';
            const remindDate = new Date(r.remind_at);
            const dateStr = new Intl.DateTimeFormat('id-ID', {
                timeZone: 'Asia/Jakarta',
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(remindDate);

            embed.addFields({
                name: `${idx + 1}. ${badge} [${dateStr} WIB]`,
                value: `💬 *${r.title}*`,
                inline: false,
            });
        });
    }

    embed.setFooter({ text: BOT_FOOTER }).setTimestamp();
    return embed;
}

module.exports = {
    getMainHelpEmbed,
    getMusicHelpEmbed,
    getAssistantHelpEmbed,
    getMemoriesEmbed,
    getVoiceSettingsEmbed,
    getWebSearchEmbed,
    getWeatherEmbed,
    getAnalyticsDashboardEmbed,
    getFinanceAnalyticsEmbed,
    getTaskAnalyticsEmbed,
    getUserRoleEmbed,
    getRoleListEmbed,
    getAuditLogsEmbed,
    getSecurityStatusEmbed,
    getHealthStatusEmbed,
    getSchedulesEmbed,
    getTasksEmbed,
    getRemindersEmbed,
    BOT_FOOTER,
};
