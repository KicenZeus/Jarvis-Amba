const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname);
const DOCKER_CONTAINER = 'jarvis-postgres';
const DB_USER = 'jarvis';
const DB_NAME = 'jarvis';

function executePsql(sql) {
    // Jalankan sql ke container postgres
    return execSync(`docker exec -i ${DOCKER_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME}`, {
        input: sql,
        encoding: 'utf-8',
    });
}

function ensureMigrationTable() {
    const sql = `
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        );
    `;
    executePsql(sql);
}

function getAppliedMigrations() {
    ensureMigrationTable();
    const output = executePsql(`SELECT version FROM schema_migrations ORDER BY version ASC;`);
    const lines = output.split('\n').map(l => l.trim()).filter(Boolean);
    const versions = [];
    let startCollect = false;
    for (const line of lines) {
        if (line.startsWith('---')) {
            startCollect = true;
            continue;
        }
        if (line.includes('rows)') || line.includes('row)')) break;
        if (startCollect && line) {
            versions.push(line);
        }
    }
    return versions;
}

function runUp() {
    console.log('🚀 Menjalankan migrasi database (UP)...');
    ensureMigrationTable();
    const applied = getAppliedMigrations();
    console.log(`📋 Migrasi terpasang saat ini (${applied.length}):`, applied.join(', ') || 'Belum ada');

    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql') && !f.endsWith('_down.sql'))
        .sort();

    let count = 0;
    for (const file of files) {
        const version = file.replace('.sql', '');
        if (applied.includes(version)) {
            console.log(`⏩ [SKIP] ${file} (Sudah terpasang)`);
            continue;
        }

        console.log(`⚡ [APPLY] Menjalankan ${file}...`);
        const filePath = path.join(MIGRATIONS_DIR, file);
        const sqlContent = fs.readFileSync(filePath, 'utf-8');

        // Jalankan file SQL
        executePsql(sqlContent);

        // Catat ke schema_migrations
        executePsql(`INSERT INTO schema_migrations (version, name) VALUES ('${version}', '${file}');`);
        console.log(`✅ [SUCCESS] ${file} berhasil diterapkan.`);
        count++;
    }

    if (count === 0) {
        console.log('✨ Semua migrasi sudah mutakhir!');
    } else {
        console.log(`🎉 Berhasil menerapkan ${count} migrasi.`);
    }
}

function runDown() {
    console.log('⚠️ Menjalankan rollback migrasi database (DOWN)...');
    ensureMigrationTable();
    const applied = getAppliedMigrations();
    if (applied.length === 0) {
        console.log('Tidak ada migrasi yang bisa di-rollback.');
        return;
    }

    const lastVersion = applied[applied.length - 1];
    const downFile = `${lastVersion}_down.sql`;
    const downFilePath = path.join(MIGRATIONS_DIR, downFile);

    if (!fs.existsSync(downFilePath)) {
        console.error(`❌ File rollback ${downFile} tidak ditemukan!`);
        process.exit(1);
    }

    console.log(`⚡ [ROLLBACK] Menjalankan ${downFile}...`);
    const sqlContent = fs.readFileSync(downFilePath, 'utf-8');
    executePsql(sqlContent);
    console.log(`✅ [SUCCESS] Rollback ${lastVersion} berhasil diselesaikan.`);
}

function runStatus() {
    ensureMigrationTable();
    const applied = getAppliedMigrations();
    console.log('\n📊 STATUS MIGRASI DATABASE:');
    console.log('----------------------------------------------------');
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql') && !f.endsWith('_down.sql'))
        .sort();

    for (const file of files) {
        const version = file.replace('.sql', '');
        const isApplied = applied.includes(version);
        console.log(`${isApplied ? '✅ [APPLIED]' : '⏳ [PENDING]'} ${file}`);
    }
    console.log('----------------------------------------------------\n');
}

const command = (process.argv[2] || 'status').toLowerCase();
if (command === 'up') {
    runUp();
} else if (command === 'down') {
    runDown();
} else {
    runStatus();
}
