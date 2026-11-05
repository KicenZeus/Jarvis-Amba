const fs = require('fs');
const path = require('path');
const db = require('./db');

/**
 * Otomatis mengeksekusi migrasi database PostgreSQL saat bot dinyalakan.
 * Memastikan tabel terbuat secara otomatis saat dideploy ke Railway / cloud database.
 */
async function runAutoMigrations() {
    try {
        // 1. Buat tabel schema_migrations jika belum ada
        await db.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // 2. Ambil daftar migrasi yang sudah pernah diaplikasikan
        const res = await db.query('SELECT version FROM schema_migrations ORDER BY version ASC;');
        const appliedVersions = new Set(res.rows.map((r) => r.version));

        // 3. Cari file migrasi .sql
        const migrationsDir = path.join(__dirname, 'migrations');
        if (!fs.existsSync(migrationsDir)) return;

        const files = fs.readdirSync(migrationsDir)
            .filter((f) => f.endsWith('.sql') && !f.endsWith('_down.sql'))
            .sort();

        let count = 0;
        for (const file of files) {
            const version = file.replace('.sql', '');
            if (!appliedVersions.has(version)) {
                console.log(`📦 [Migration] Menerapkan migrasi: ${file}...`);
                const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
                await db.query('BEGIN');
                try {
                    await db.query(sql);
                    await db.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2);', [version, file]);
                    await db.query('COMMIT');
                    console.log(`✅ [Migration] Sukses: ${file}`);
                    count++;
                } catch (err) {
                    await db.query('ROLLBACK');
                    console.error(`❌ [Migration] Gagal pada ${file}:`, err.message);
                    throw err;
                }
            }
        }

        if (count > 0) {
            console.log(`🎉 [Migration] ${count} migrasi database berhasil diterapkan!`);
        } else {
            console.log('✅ [Migration] Database up-to-date.');
        }
    } catch (err) {
        console.warn('⚠️ [Migration] Error saat menjalankan auto-migration:', err.message);
    }
}

module.exports = { runAutoMigrations };
