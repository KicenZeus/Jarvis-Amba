/**
 * ==============================================================================
 * Jarvis V2.1: WhatsApp Webhook & Tunnel Status Checker
 * Menampilkan URL Webhook aktif (Railway Cloud / Local Tunnel) & memvalidasi status
 * ==============================================================================
 */

const path = require('path');
const { execSync } = require('child_process');

// Load environment variables dari discord-bot/.env jika ada
try {
    require('dotenv').config({ path: path.join(__dirname, '../discord-bot/.env') });
} catch (_) {}

async function testWebhook(webhookUrl, verifyToken) {
    try {
        const testUrl = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=STATUS_OK`;
        const res = await fetch(testUrl);
        const body = await res.text();
        return { ok: res.ok && body === 'STATUS_OK', status: res.status, body };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

async function main() {
    console.log('\n===================================================================');
    console.log('       JARVIS V2.1 - STATUS WHATSAPP META WEBHOOK & ENDPOINTS       ');
    console.log('===================================================================\n');

    const verifyToken = process.env.WA_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || 'jarvis_amba_wa_secret_2026';
    const railwayBase = process.env.BOT_URL || 'https://jarvis-amba-production.up.railway.app';
    const railwayWebhook = `${railwayBase}/webhook/whatsapp`;

    console.log(`🌐 1. MEMERIKSA WEBHOOK PRODUCTION (RAILWAY CLOUD)...`);
    console.log(`   URL Endpoint : ${railwayWebhook}`);
    const cloudTest = await testWebhook(railwayWebhook, verifyToken);
    if (cloudTest.ok) {
        console.log(`   ✅ Status    : ONLINE & VALID! (Respon HTTP 200 OK)`);
    } else {
        console.log(`   ⚠️ Status    : ${cloudTest.error ? cloudTest.error : `HTTP ${cloudTest.status} (${cloudTest.body})`}`);
    }

    // Periksa tunnel lokal Docker jika ada
    let tunnelUrl = null;
    try {
        let logs = '';
        try {
            logs = execSync('docker compose logs --tail 100 tunnel 2>nul', { encoding: 'utf8' });
        } catch (_) {
            logs = execSync('docker logs --tail 100 jarvis-tunnel 2>nul', { encoding: 'utf8' });
        }
        const matches = [...logs.matchAll(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g)];
        if (matches.length > 0) {
            tunnelUrl = matches[matches.length - 1][0];
        }
    } catch (_) {}

    if (tunnelUrl) {
        console.log(`\n🏠 2. MEMERIKSA WEBHOOK LOKAL (CLOUDFLARE TUNNEL)...`);
        console.log(`   URL Tunnel   : ${tunnelUrl}/webhook/whatsapp`);
        const localTest = await testWebhook(`${tunnelUrl}/webhook/whatsapp`, verifyToken);
        if (localTest.ok) {
            console.log(`   ✅ Status    : ONLINE & VALID! (Respon HTTP 200 OK)`);
        } else {
            console.log(`   ⚠️ Status    : ${localTest.error || `HTTP ${localTest.status}`}`);
        }
    }

    const activeWebhookUrl = cloudTest.ok ? railwayWebhook : (tunnelUrl ? `${tunnelUrl}/webhook/whatsapp` : railwayWebhook);

    console.log('\n📌 INFORMASI RESMI UNTUK META DEVELOPER DASHBOARD:');
    console.log('-------------------------------------------------------------------');
    console.log(`🔗 URL Callback    : ${activeWebhookUrl}`);
    console.log(`🔑 Token Verifikasi: ${verifyToken}`);
    console.log('-------------------------------------------------------------------\n');

    console.log('📋 PANDUAN PENGATURAN DI META DASHBOARD:');
    console.log('1. Buka https://developers.facebook.com/apps/ > Pilih aplikasi Jarvis');
    console.log('2. Buka menu: WhatsApp > Konfigurasi > Bagian Webhook');
    console.log('3. Klik "Edit", masukkan URL Callback dan Token Verifikasi di atas');
    console.log('4. Klik "Verifikasi dan Simpan"');
    console.log('5. Di kolom Webhook Fields, pastikan event "messages" sudah Berlangganan (Subscribed)');
    console.log('===================================================================\n');
}

main().catch(console.error);
