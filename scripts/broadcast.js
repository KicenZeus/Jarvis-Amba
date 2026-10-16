const readline = require('readline');

/**
 * ==============================================================================
 * Jarvis V2.1: Multi-Channel Broadcast CLI Runner (WhatsApp & Discord)
 * Mengirim pesan massal serentak ke seluruh pengguna terdaftar
 * ==============================================================================
 */

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:5001/api/broadcast';
const DEFAULT_OWNER_ID = '713137141072396370';

async function sendBroadcast({ message, target, userId = DEFAULT_OWNER_ID }) {
    console.log(`\n⏳ Mengirim pengumuman ke Jarvis Bot (${target})...`);
    try {
        const res = await fetch(BOT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message.trim(),
                target: target.toUpperCase(),
                userId,
            }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
            console.error(`\n❌ Gagal mengirim broadcast: HTTP ${res.status} - ${data?.error || 'Unknown error'}`);
            process.exit(1);
        }

        if (data.success) {
            console.log(`\n======================================================`);
            console.log(`🎉 BROADCAST BERHASIL DIKIRIMKAN!`);
            console.log(`======================================================`);
            console.log(`• Target Saluran    : ${target.toUpperCase()}`);
            console.log(`• Pesan Terkirim    : ${data.delivered} pengguna`);
            console.log(`• Pengiriman Gagal  : ${data.failed} pengguna`);
            console.log(`• Total Terdaftar   : ${data.total} akun`);
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

function promptInteractive() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    console.log(`\n======================================================`);
    console.log(`📢  JARVIS AMBA - BROADCAST & PENGUMUMAN MASSAL`);
    console.log(`======================================================`);
    console.log(`Fitur ini akan menyiarkan pesan serentak ke semua user`);
    console.log(`yang sudah pernah berinteraksi di WhatsApp dan Discord.`);
    console.log(`======================================================\n`);

    rl.question('📝 Masukkan pesan pengumuman:\n> ', (message) => {
        if (!message || !message.trim()) {
            console.log('\n❌ Pesan tidak boleh kosong. Operasi dibatalkan.');
            rl.close();
            return;
        }

        console.log('\n🎯 Pilih saluran tujuan:');
        console.log('  1. SEMUA SALURAN (WhatsApp & Discord) [Default]');
        console.log('  2. Hanya WhatsApp');
        console.log('  3. Hanya Discord');

        rl.question('\nPilihan (1/2/3) [Default: 1]: ', (targetChoice) => {
            let target = 'ALL';
            if (targetChoice.trim() === '2') target = 'WHATSAPP';
            else if (targetChoice.trim() === '3') target = 'DISCORD';

            console.log(`\n------------------------------------------------------`);
            console.log(`Saluran : ${target}`);
            console.log(`Pesan   : "${message.trim()}"`);
            console.log(`------------------------------------------------------`);

            rl.question('\n⚠️ Yakin ingin mengirim broadcast sekarang? (y/N): ', async (confirm) => {
                rl.close();
                if (confirm.trim().toLowerCase() === 'y' || confirm.trim().toLowerCase() === 'ya') {
                    await sendBroadcast({ message, target });
                } else {
                    console.log('\n🛑 Pengiriman broadcast dibatalkan oleh pengguna.');
                }
            });
        });
    });
}

// Entrypoint
const args = process.argv.slice(2);
if (args.length > 0) {
    let message = '';
    let target = 'ALL';

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--target=')) {
            target = arg.split('=')[1];
        } else if (arg === '--target' || arg === '-t') {
            target = args[++i] || 'ALL';
        } else if (arg === '--message' || arg === '-m') {
            message = args[++i] || '';
        } else if (!message) {
            message = arg;
        }
    }

    if (!message) {
        promptInteractive();
    } else {
        sendBroadcast({ message, target });
    }
} else {
    promptInteractive();
}
