const readline = require('readline');

/**
 * ==============================================================================
 * Jarvis V2.1: Multi-Channel Broadcast CLI Runner (WhatsApp & Discord)
 * Mengirim pesan massal serentak ke seluruh pengguna terdaftar
 * Mendukung jadwal, filter saluran, role, dan kontak tertentu dengan nomor urut
 * Khusus Hak Akses OWNER
 * ==============================================================================
 */

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:5001/api/broadcast';
const BOT_USERS_URL = process.env.BOT_USERS_URL || 'http://localhost:5001/api/users';
const DEFAULT_OWNER_ID = '713137141072396370';

async function fetchRegisteredUsers() {
    try {
        const res = await fetch(BOT_USERS_URL, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) return [];
        const data = await res.json().catch(() => null);
        return Array.isArray(data?.users) ? data.users : [];
    } catch {
        return [];
    }
}

async function sendBroadcast({ message, target = 'ALL', schedule = null, role = null, to = null, userId = DEFAULT_OWNER_ID }) {
    console.log(`\n⏳ Menghubungi Jarvis Bot API (${BOT_API_URL})...`);
    try {
        const payload = {
            message: message ? message.trim() : '',
            target: (target || 'ALL').toUpperCase(),
            schedule: schedule ? schedule.trim() : null,
            targetRole: role ? role.trim().toUpperCase() : null,
            targetRecipients: to ? String(to).split(',').map((s) => s.trim()).filter(Boolean) : null,
            userId,
        };

        const res = await fetch(BOT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
            console.error(`\n❌ Gagal memproses broadcast: HTTP ${res.status} - ${data?.error || 'Unknown error'}`);
            process.exit(1);
        }

        // Response untuk Terjadwal
        if (data.isScheduled || data.broadcast) {
            console.log(`\n======================================================`);
            console.log(`📅 BROADCAST BERHASIL DIJADWALKAN!`);
            console.log(`======================================================`);
            console.log(`• ID Jadwal         : #${data.broadcast?.id || data.id}`);
            console.log(`• Waktu Pengiriman  : ${data.formattedTime || data.broadcast?.scheduled_at}`);
            console.log(`• Target Saluran    : ${payload.target}`);
            if (payload.targetRole) console.log(`• Target Role       : ${payload.targetRole}`);
            if (payload.targetRecipients) console.log(`• Kontak Tertentu   : ${payload.targetRecipients.join(', ')}`);
            console.log(`• Pesan             : "${payload.message}"`);
            console.log(`======================================================`);
            console.log(`✨ Sistem proactive scheduler Jarvis akan mengirimkannya otomatis.`);
            return;
        }

        // Response untuk Instan
        if (data.success) {
            console.log(`\n======================================================`);
            console.log(`🎉 BROADCAST INSTAN BERHASIL DIKIRIMKAN!`);
            console.log(`======================================================`);
            console.log(`• Target Saluran    : ${payload.target}`);
            if (payload.targetRole) console.log(`• Target Role       : ${payload.targetRole}`);
            if (payload.targetRecipients) console.log(`• Kontak Tertentu   : ${payload.targetRecipients.join(', ')}`);
            console.log(`• Pesan Terkirim    : ${data.delivered} pengguna`);
            console.log(`• Pengiriman Gagal  : ${data.failed} pengguna`);
            console.log(`• Total Akun Cocok  : ${data.total} akun`);
            console.log(`======================================================`);

            if (data.details && data.details.length > 0) {
                console.log(`\nRincian Pengiriman:`);
                data.details.forEach((d) => {
                    const icon = d.status === 'SUCCESS' ? '✅' : '❌';
                    console.log(`  ${icon} [${d.channel}] ${d.user} (${d.target}) -> ${d.status}${d.error ? ` [${d.error}]` : ''}`);
                });
            }
        } else {
            console.error(`\n❌ Broadcast gagal: ${data.error || 'Operasi ditolak'}`);
        }
    } catch (err) {
        console.error(`\n❌ Gagal terhubung ke Jarvis Bot (${BOT_API_URL}): ${err.message}`);
        console.error(`💡 Tips: Pastikan Docker container 'jarvis-bot' sedang berjalan di port 5001.`);
        process.exit(1);
    }
}

async function listSchedules() {
    console.log(`\n⏳ Mengambil daftar jadwal broadcast aktif...`);
    try {
        const res = await fetch(BOT_API_URL, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data.success) {
            console.error(`\n❌ Gagal mengambil daftar jadwal: ${data?.error || `HTTP ${res.status}`}`);
            return;
        }

        console.log(`\n======================================================`);
        console.log(`📅 DAFTAR JADWAL BROADCAST AKTIF`);
        console.log(`======================================================`);

        if (!data.broadcasts || data.broadcasts.length === 0) {
            console.log(`(Tidak ada jadwal broadcast yang sedang pending/menunggu.)`);
            console.log(`======================================================`);
            return;
        }

        data.broadcasts.forEach((b) => {
            console.log(`\n📌 [ID #${b.id}] Saluran: ${b.target_channel || 'ALL'}`);
            console.log(`   • Waktu Kirim : ${b.formatted_time || b.scheduled_at}`);
            if (b.target_role) console.log(`   • Filter Role : ${b.target_role}`);
            if (b.target_recipients && b.target_recipients.length > 0) {
                console.log(`   • Kontak      : ${b.target_recipients.join(', ')}`);
            }
            console.log(`   • Pesan       : "${b.message}"`);
        });
        console.log(`\n======================================================`);
    } catch (err) {
        console.error(`\n❌ Gagal terhubung ke Jarvis Bot: ${err.message}`);
    }
}

async function cancelSchedule(broadcastId) {
    if (!broadcastId) {
        console.error('\n❌ ID broadcast wajib diisi.');
        return;
    }
    console.log(`\n⏳ Membatalkan jadwal broadcast #${broadcastId}...`);
    try {
        const res = await fetch(BOT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'cancel',
                broadcastId,
                userId: DEFAULT_OWNER_ID,
            }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data.success) {
            console.error(`\n❌ Gagal membatalkan: ${data?.error || `HTTP ${res.status}`}`);
            return;
        }

        console.log(`\n✅ ${data.message || `Jadwal broadcast #${broadcastId} berhasil dibatalkan!`}`);
    } catch (err) {
        console.error(`\n❌ Gagal terhubung ke Jarvis Bot: ${err.message}`);
    }
}

async function kickUser(identifier) {
    if (!identifier) {
        console.error('\n❌ ID atau nomor kontak pengguna wajib diisi.');
        return;
    }
    console.log(`\n⏳ Mengirim permintaan pencabutan akses untuk [${identifier}]...`);
    try {
        const res = await fetch(BOT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'kick',
                identifier,
                requestedBy: DEFAULT_OWNER_ID,
            }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data.success) {
            console.error(`\n❌ Gagal mengeluarkan user: ${data?.message || data?.error || `HTTP ${res.status}`}`);
            return;
        }

        console.log(`\n${data.message}`);
    } catch (err) {
        console.error(`\n❌ Gagal terhubung ke Jarvis Bot: ${err.message}`);
    }
}

function formatUserDisplay(user, index) {
    const ch = (user.channel_type || 'ALL').toUpperCase();
    const idOrPhone = user.phone_number || user.external_user_id || user.id;
    const name = user.display_name || user.callsign || 'Tanpa Nama';
    const role = (user.role || 'USER').toUpperCase();
    const badge = role === 'OWNER' ? '👑 OWNER' : (role === 'ADMIN' ? '🛡️ ADMIN' : '👥 USER');
    return `  (${index + 1}) [${ch.padEnd(8)}] ${String(idOrPhone).padEnd(16)} ${name.padEnd(18)} ${badge}`;
}

async function promptInteractive() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const ask = (q) => new Promise((resolve) => rl.question(q, (ans) => resolve(ans ? ans.trim() : '')));

    try {
        console.log(`\n======================================================`);
        console.log(`📢  JARVIS AMBA - BROADCAST & PENGUMUMAN MASSAL`);
        console.log(`======================================================`);
        console.log(`Sistem siaran serentak & terjadwal WhatsApp & Discord`);
        console.log(`Khusus Hak Akses Owner (Jarvis Core Security)`);
        console.log(`======================================================`);
        console.log(`Pilih Menu:`);
        console.log(`  1. 📢 Kirim Broadcast Instan (Kirim Sekarang)`);
        console.log(`  2. ⏰ Jadwalkan Broadcast (Terjadwal / Reminder)`);
        console.log(`  3. 📋 Lihat Daftar Jadwal Broadcast`);
        console.log(`  4. ❌ Batalkan Jadwal Broadcast`);
        console.log(`  5. 👥 Kelola Pengguna (Lihat Daftar & Hapus/Kick User)`);
        console.log(`  6. 🚪 Keluar`);

        const choice = await ask('\nPilihan (1-6): ');

        if (choice === '3') {
            rl.close();
            await listSchedules();
            return;
        }

        if (choice === '4') {
            const id = await ask('\nMasukkan ID Jadwal yang ingin dibatalkan (misal: 1): ');
            rl.close();
            await cancelSchedule(id);
            return;
        }

        if (choice === '5') {
            console.log(`\n⏳ Mengambil data pengguna terdaftar...`);
            const users = await fetchRegisteredUsers();
            console.log(`\n======================================================`);
            console.log(`👥 DAFTAR PENGGUNA TERDAFTAR (TOTAL: ${users.length})`);
            console.log(`======================================================`);
            if (users.length === 0) {
                console.log(`(Belum ada pengguna terdaftar dalam database)`);
            } else {
                users.forEach((u, i) => {
                    console.log(formatUserDisplay(u, i));
                });
                console.log(`======================================================`);
                console.log(`\n💡 Masukkan nomor urut pengguna yang ingin DI-KICK / DIHAPUS`);
                console.log(`(Atau tekan ENTER untuk batal/kembali)`);
                const numToKick = await ask('> ');
                if (numToKick) {
                    const idx = parseInt(numToKick, 10);
                    if (!isNaN(idx) && idx >= 1 && idx <= users.length) {
                        const targetUser = users[idx - 1];
                        const targetId = targetUser.phone_number || targetUser.external_user_id || targetUser.id;
                        const roleBadge = (targetUser.role || 'USER').toUpperCase();
                        if (roleBadge === 'OWNER') {
                            console.log('\n⛔ Akun OWNER utama dilindungi dan tidak dapat dihapus!');
                        } else {
                            const conf = await ask(`\n⚠️ Yakin ingin MENGHAPUS & ME-REVOKE ${targetUser.display_name} (${targetId}) [${roleBadge}] dari database? (y/N): `);
                            if (conf.toLowerCase() === 'y' || conf.toLowerCase() === 'ya') {
                                await kickUser(targetId);
                            } else {
                                console.log('\n🛑 Pembatalan: Pengguna tidak dihapus.');
                            }
                        }
                    } else {
                        console.log('\n❌ Nomor urut tidak valid.');
                    }
                }
            }
            rl.close();
            return;
        }

        if (choice === '6') {
            console.log('\nSampai jumpa!');
            rl.close();
            return;
        }

        if (choice !== '1' && choice !== '2') {
            console.log('\n❌ Pilihan tidak valid.');
            rl.close();
            return;
        }

        const isScheduleMode = choice === '2';

        const message = await ask('\n📝 Masukkan isi pesan pengumuman:\n> ');
        if (!message) {
            console.log('\n❌ Pesan tidak boleh kosong. Operasi dibatalkan.');
            rl.close();
            return;
        }

        console.log('\n🎯 Pilih saluran tujuan:');
        console.log('  1. SEMUA SALURAN (WhatsApp & Discord) [Default]');
        console.log('  2. Hanya WhatsApp');
        console.log('  3. Hanya Discord');

        const targetChoice = await ask('\nPilihan (1/2/3) [Default: 1]: ');
        let target = 'ALL';
        if (targetChoice === '2') target = 'WHATSAPP';
        else if (targetChoice === '3') target = 'DISCORD';

        console.log(`\n⏳ Mengambil data pengguna terdaftar...`);
        const allUsers = await fetchRegisteredUsers();

        // Saring user berdasarkan saluran
        let channelUsers = allUsers;
        if (target === 'WHATSAPP') {
            channelUsers = allUsers.filter((u) => u.channel_type === 'WHATSAPP');
        } else if (target === 'DISCORD') {
            channelUsers = allUsers.filter((u) => u.channel_type === 'DISCORD');
        }

        console.log(`\n👥 Pilih Mode Target Penerima:`);
        console.log(`  1. 🌐 SEMUA USER (Tampilkan semua kontak & pilih nomor urut) [Default]`);
        console.log(`  2. 🛡️ Filter Berdasarkan ROLE (Hanya OWNER / ADMIN / USER)`);

        const modeChoice = await ask('\nPilihan (1/2) [Default: 1]: ');
        const isRoleFilter = modeChoice === '2';

        let finalRole = null;
        let finalTo = null;

        if (isRoleFilter) {
            console.log('\n🎯 Pilih Role yang ingin disasar:');
            console.log('  1. Hanya OWNER');
            console.log('  2. Hanya ADMIN');
            console.log('  3. Hanya USER');

            const rChoice = await ask('\nPilihan Role (1/2/3): ');
            let selectedRole = 'USER';
            if (rChoice === '1') selectedRole = 'OWNER';
            else if (rChoice === '2') selectedRole = 'ADMIN';

            const roleUsers = channelUsers.filter((u) => (u.role || '').toUpperCase() === selectedRole);

            console.log(`\n======================================================`);
            console.log(`📋 DAFTAR PENGGUNA DENGAN ROLE [${selectedRole}] (Saluran: ${target})`);
            console.log(`======================================================`);

            if (roleUsers.length === 0) {
                console.log(`(Tidak ada pengguna dengan role ${selectedRole} di saluran ${target})`);
                console.log(`\nOperasi dibatalkan.`);
                rl.close();
                return;
            }

            roleUsers.forEach((u, i) => {
                console.log(formatUserDisplay(u, i));
            });
            console.log(`======================================================`);

            console.log(`\n🎯 Tentukan Penerima:`);
            console.log(`• Tekan ENTER atau ketik 'SEMUA' untuk kirim ke SEMUA (${roleUsers.length}) kontak [${selectedRole}] di atas`);
            console.log(`• Atau masukkan nomor urut (contoh: 1 atau 1,2):`);

            const numChoice = await ask('> ');
            if (numChoice && numChoice.toUpperCase() !== 'SEMUA' && numChoice.toUpperCase() !== 'ALL') {
                const indices = numChoice
                    .split(/[,\s]+/)
                    .map((s) => parseInt(s.trim(), 10))
                    .filter((n) => !isNaN(n) && n >= 1 && n <= roleUsers.length);

                if (indices.length > 0) {
                    const selectedContacts = indices.map((idx) => roleUsers[idx - 1]);
                    finalTo = selectedContacts.map((c) => c.phone_number || c.external_user_id || c.id).join(',');
                    finalRole = null;

                    console.log(`\n✅ Dipilih ${selectedContacts.length} kontak:`);
                    selectedContacts.forEach((c) => {
                        console.log(`  • [${c.channel_type}] ${c.phone_number || c.external_user_id} - ${c.display_name} (${c.role})`);
                    });
                } else {
                    console.log(`⚠️ Input tidak valid. Otomatis menargetkan seluruh (${roleUsers.length}) kontak [${selectedRole}].`);
                    finalRole = selectedRole;
                }
            } else {
                console.log(`\n✅ Menargetkan seluruh pengguna dengan role [${selectedRole}].`);
                finalRole = selectedRole;
            }
        } else {
            console.log(`\n======================================================`);
            console.log(`📋 DAFTAR KONTAK TERDAFTAR (Saluran: ${target})`);
            console.log(`======================================================`);

            if (channelUsers.length === 0) {
                console.log(`(Belum ada kontak terdaftar pada saluran ${target})`);
                console.log(`\nOperasi dibatalkan.`);
                rl.close();
                return;
            }

            channelUsers.forEach((u, i) => {
                console.log(formatUserDisplay(u, i));
            });
            console.log(`======================================================`);

            console.log(`\n🎯 Tentukan Penerima:`);
            console.log(`• Tekan ENTER atau ketik 'SEMUA' untuk kirim ke SEMUA (${channelUsers.length}) kontak di atas`);
            console.log(`• Atau masukkan nomor urut (contoh: 1 atau 1, 2 atau 2, 4, 7):`);

            const numChoice = await ask('> ');
            if (numChoice && numChoice.toUpperCase() !== 'SEMUA' && numChoice.toUpperCase() !== 'ALL') {
                const indices = numChoice
                    .split(/[,\s]+/)
                    .map((s) => parseInt(s.trim(), 10))
                    .filter((n) => !isNaN(n) && n >= 1 && n <= channelUsers.length);

                if (indices.length > 0) {
                    const selectedContacts = indices.map((idx) => channelUsers[idx - 1]);
                    finalTo = selectedContacts.map((c) => c.phone_number || c.external_user_id || c.id).join(',');

                    console.log(`\n✅ Dipilih ${selectedContacts.length} kontak:`);
                    selectedContacts.forEach((c) => {
                        console.log(`  • [${c.channel_type}] ${c.phone_number || c.external_user_id} - ${c.display_name} (${c.role})`);
                    });
                } else {
                    console.log(`⚠️ Input tidak valid. Otomatis menargetkan seluruh (${channelUsers.length}) kontak terdaftar.`);
                }
            } else {
                console.log(`\n✅ Menargetkan seluruh (${channelUsers.length}) kontak terdaftar.`);
            }
        }

        console.log(`\n------------------------------------------------------`);
        console.log(`Saluran : ${target}`);
        if (finalRole) console.log(`Role    : ${finalRole}`);
        if (finalTo) console.log(`Kontak  : ${finalTo}`);
        console.log(`Pesan   : "${message}"`);
        console.log(`------------------------------------------------------`);

        if (isScheduleMode) {
            console.log('\n⏰ Tentukan Waktu Jadwal:');
            console.log('  • Relatif : 10m (10 menit lagi), 1h (1 jam lagi), 1d (1 hari lagi)');
            console.log('  • Jam WIB : 15:30 (jam 15:30 WIB hari ini/besok)');
            console.log('  • Tanggal : 2026-10-17 09:00');
            const schedInput = await ask('\nMasukkan waktu jadwal:\n> ');
            if (!schedInput) {
                console.log('\n❌ Waktu jadwal tidak boleh kosong.');
                rl.close();
                return;
            }

            const conf = await ask(`\n⚠️ Konfirmasi jadwalkan pesan ini pada "${schedInput}"? (y/N): `);
            rl.close();
            if (conf.toLowerCase() === 'y' || conf.toLowerCase() === 'ya') {
                await sendBroadcast({ message, target, schedule: schedInput, role: finalRole, to: finalTo });
            } else {
                console.log('\n🛑 Penjadwalan dibatalkan oleh pengguna.');
            }
        } else {
            const conf = await ask('\n⚠️ Yakin ingin mengirim broadcast sekarang secara instan? (y/N): ');
            rl.close();
            if (conf.toLowerCase() === 'y' || conf.toLowerCase() === 'ya') {
                await sendBroadcast({ message, target, schedule: null, role: finalRole, to: finalTo });
            } else {
                console.log('\n🛑 Pengiriman broadcast dibatalkan oleh pengguna.');
            }
        }
    } catch (err) {
        console.error('⚠️ Terjadi kesalahan:', err.message);
        rl.close();
    }
}

// Entrypoint CLI (Non-interaktif jika diberikan argumen)
const args = process.argv.slice(2);
if (args.length > 0) {
    let message = '';
    let target = 'ALL';
    let schedule = null;
    let role = null;
    let to = null;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--list' || arg === '-l') {
            listSchedules();
            return;
        } else if (arg === '--cancel' || arg === '-c') {
            const id = args[++i];
            cancelSchedule(id);
            return;
        } else if (arg === '--kick' || arg === '-k') {
            const id = args[++i];
            kickUser(id);
            return;
        } else if (arg.startsWith('--target=')) {
            target = arg.split('=')[1];
        } else if (arg === '--target' || arg === '-t') {
            target = args[++i] || 'ALL';
        } else if (arg.startsWith('--schedule=')) {
            schedule = arg.split('=')[1];
        } else if (arg === '--schedule' || arg === '-s') {
            schedule = args[++i] || null;
        } else if (arg.startsWith('--role=')) {
            role = arg.split('=')[1];
        } else if (arg === '--role' || arg === '-r') {
            role = args[++i] || null;
        } else if (arg.startsWith('--to=')) {
            to = arg.split('=')[1];
        } else if (arg === '--to') {
            to = args[++i] || null;
        } else if (arg === '--message' || arg === '-m') {
            message = args[++i] || '';
        } else if (!message && !arg.startsWith('-')) {
            message = arg;
        }
    }

    if (!message) {
        promptInteractive();
    } else {
        sendBroadcast({ message, target, schedule, role, to });
    }
} else {
    promptInteractive();
}
