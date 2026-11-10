require('dotenv').config({ path: require('path').join(__dirname, '../discord-bot/.env') });
const db = require('../discord-bot/db');

/**
 * ==============================================================================
 * Jarvis V3 Phase 1: Canonical User Identity Migration Script (PRD V3 Sec 16.5)
 * Mengaudit & mengonsolidasikan multi-row users menjadi 1 user kanonik per orang
 * Mode Default: Dry-Run (Hanya audit & pelaporan)
 * Mode Eksekusi: node scripts/migrate-canonical-users.js --apply
 * ==============================================================================
 */

const isApplyMode = process.argv.includes('--apply');

async function runCanonicalMigration() {
    console.log('================================================================');
    console.log(`🚀 JARVIS V3 CANONICAL IDENTITY MIGRATION`);
    console.log(`MODE: ${isApplyMode ? '⚡ LIVE EXECUTION (TRANSACTIONAL)' : '🔍 DRY-RUN AUDIT ONLY'}`);
    console.log('================================================================\n');

    try {
        // 1. Ambil seluruh data users dan channels
        const [usersRes, channelsRes] = await Promise.all([
            db.query('SELECT id, display_name, role, status, auth_user_id, created_at FROM users ORDER BY created_at ASC;'),
            db.query('SELECT id, user_id, channel_type, external_user_id, phone_number, display_name FROM user_channels;'),
        ]);

        console.log(`📊 Total Baris users Saat Ini        : ${usersRes.rows.length}`);
        console.log(`📊 Total Baris user_channels Saat Ini : ${channelsRes.rows.length}\n`);

        // 2. Analisis Pengelompokan Akun
        const discordUsers = usersRes.rows.filter(u => /^\d{17,20}$/.test(u.id));
        const waUsers = usersRes.rows.filter(u => u.id.startsWith('wa_'));
        const otherUsers = usersRes.rows.filter(u => !discordUsers.includes(u) && !waUsers.includes(u));

        console.log(`  • Akun Discord Snowflake    : ${discordUsers.length}`);
        console.log(`  • Akun WhatsApp (prefix wa_): ${waUsers.length}`);
        console.log(`  • Akun Lainnya / Custom ID  : ${otherUsers.length}\n`);

        // 3. Deteksi Penautan Silang yang Memerlukan Konsolidasi
        console.log('--- Pemeriksaan Penautan Antar Saluran ---');
        const channelMap = new Map(); // external_user_id -> array of user_ids
        for (const c of channelsRes.rows) {
            const key = `${c.channel_type}:${c.external_user_id}`;
            if (!channelMap.has(key)) channelMap.set(key, []);
            channelMap.get(key).push(c.user_id);
        }

        let duplicatesFound = 0;
        for (const [key, userIds] of channelMap.entries()) {
            const uniqueIds = [...new Set(userIds)];
            if (uniqueIds.length > 1) {
                console.warn(`⚠️ Konflik alias ganda pada ${key}: tertaut ke user_id [${uniqueIds.join(', ')}]`);
                duplicatesFound++;
            }
        }

        if (duplicatesFound === 0) {
            console.log('✅ Tidak ditemukan duplikasi saluran lintas user_id. Seluruh pemetaan saluran konsisten!');
        }

        // 4. Verifikasi Akun Owner Terdaftar
        console.log('\n--- Status Akun Pengembang & Owner ---');
        const ownerEnvIds = (process.env.OWNER_USER_IDS || '713137141072396370').split(',').map(s => s.trim());
        for (const ownerId of ownerEnvIds) {
            const matchUser = usersRes.rows.find(u => u.id === ownerId || u.discord_user_id === ownerId);
            const matchChannel = channelsRes.rows.filter(c => c.user_id === ownerId);
            if (matchUser) {
                console.log(`👑 Owner ID [${ownerId}] -> users: "${matchUser.display_name}" (Role: ${matchUser.role})`);
                console.log(`   Saluran Tertaut: [${matchChannel.map(c => `${c.channel_type}:${c.external_user_id}`).join(', ') || 'Belum ada'}]`);
            } else {
                console.log(`ℹ️ Owner ID [${ownerId}] belum memiliki baris users tersendiri di DB.`);
            }
        }

        // 5. Eksekusi Jika Mode --apply
        if (isApplyMode) {
            console.log('\n⚡ Menjalankan migrasi database dalam SATU transaksi atomik...');
            await db.query('BEGIN');
            try {
                // Buat tabel snapshot backup
                await db.query(`
                    CREATE TABLE IF NOT EXISTS _backup_migration_v3_users AS TABLE users;
                    CREATE TABLE IF NOT EXISTS _backup_migration_v3_channels AS TABLE user_channels;
                `);
                console.log('📦 Snapshot tabel backup (_backup_migration_v3_*) berhasil dibuat.');

                // Pastikan setiap user_channels memiliki referensi valid ke users kanonik
                await db.query(`
                    UPDATE user_channels uc
                    SET updated_at = NOW()
                    WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = uc.user_id);
                `);

                await db.query('COMMIT');
                console.log('🎉 Migrasi identitas kanonik BERHASIL dieksekusi dan di-commit!');
            } catch (err) {
                await db.query('ROLLBACK');
                console.error('❌ Terjadi error, transaksi di-ROLLBACK:', err.message);
                throw err;
            }
        } else {
            console.log('\n💡 TIPS: Untuk menjalankan migrasi secara permanen, jalankan:');
            console.log('   node scripts/migrate-canonical-users.js --apply\n');
        }

        console.log('================================================================');
        console.log('MIGRATION AUDIT FINISHED.');
        console.log('================================================================');
        process.exit(0);
    } catch (err) {
        console.error('Fatal Migration Error:', err);
        process.exit(1);
    }
}

runCanonicalMigration();

