/**
 * ==============================================================================
 * Jarvis V2.1: WhatsApp Webhook & Tunnel Status Checker
 * Menampilkan URL Webhook aktif dan memvalidasi koneksi end-to-end
 * ==============================================================================
 */

const { execSync } = require('child_process');

async function main() {
    console.log('\n===================================================================');
    console.log('       JARVIS V2.1 - STATUS WHATSAPP META WEBHOOK & TUNNEL         ');
    console.log('===================================================================\n');

    let tunnelUrl = null;
    try {
        const logs = execSync('docker logs jarvis-tunnel 2>&1', { encoding: 'utf8' });
        const matches = [...logs.matchAll(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g)];
        if (matches.length > 0) {
            tunnelUrl = matches[matches.length - 1][0];
        }
    } catch (err) {
        console.error('❌ Gagal membaca log jarvis-tunnel:', err.message);
        return;
    }

    if (!tunnelUrl) {
        console.error('⚠️  URL Cloudflare Tunnel belum ditemukan.');
        console.log('   Pastikan container jarvis-tunnel sedang berjalan: docker compose ps\n');
        return;
    }

    const webhookUrl = `${tunnelUrl}/webhook/whatsapp`;
    const verifyToken = process.env.WA_VERIFY_TOKEN || 'jarvis_amba_wa_secret_2026';

    console.log('📌 INFORMASI UNTUK META DEVELOPER DASHBOARD:');
    console.log('-------------------------------------------------------------------');
    console.log(`🔗 URL Callback    : ${webhookUrl}`);
    console.log(`🔑 Token Verifikasi: ${verifyToken}`);
    console.log('-------------------------------------------------------------------\n');

    console.log('🔍 Menguji respon webhook lokal melalui tunnel...');
    try {
        const testUrl = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=STATUS_OK`;
        const res = await fetch(testUrl);
        const body = await res.text();

        if (res.ok && body === 'STATUS_OK') {
            console.log('✅ Webhook Endpoint: ONLINE & VALID! (Respon 200 OK)');
        } else {
            console.warn(`⚠️  Webhook merespon dengan status ${res.status}: ${body}`);
        }
    } catch (netErr) {
        console.error('❌ Gagal menghubungi tunnel:', netErr.message);
        console.log('   (Tunggu sekitar 10-30 detik jika tunnel baru saja dinyalakan)\n');
    }

    console.log('\n📋 LANGKAH SINKRONISASI JIKA WHATSAPP BELUM MERESPON:');
    console.log('1. Buka https://developers.facebook.com/apps/ > Pilih aplikasi "Jarvis Amba"');
    console.log('2. Buka menu: WhatsApp > Konfigurasi > bagian Webhook');
    console.log('3. Klik "Edit" dan tempelkan URL Callback di atas');
    console.log('4. Masukkan Token Verifikasi di atas lalu klik "Verifikasi dan Simpan"');
    console.log('5. Pastikan kolom "messages" berstatus Berlangganan (Subscribed)');
    console.log('===================================================================\n');
}

main().catch(console.error);
