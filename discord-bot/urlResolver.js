/**
 * Helper untuk mengekstrak judul dan artis dari URL eksternal (YouTube & Spotify)
 */
async function resolveExternalMusicUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();

    // 1. YouTube Link (watch, youtu.be, shorts)
    if (/https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/i.test(trimmed)) {
        try {
            const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(trimmed)}&format=json`);
            if (res.ok) {
                const data = await res.json();
                let cleanTitle = (data.title || '')
                    .replace(/\[[^\]]*\]/g, '') // Hapus [Official Music Video], [4K], dll
                    .replace(/\((official|video|audio|lyrics|mv|4k|hd|remastered)[^\)]*\)/gi, '') // Hapus (Official Video) dll
                    .replace(/\s+/g, ' ')
                    .trim();

                // Tambahkan nama channel jika belum ada di judul
                if (data.author_name && !cleanTitle.toLowerCase().includes(data.author_name.toLowerCase())) {
                    cleanTitle = `${cleanTitle} - ${data.author_name}`;
                }

                return {
                    source: 'YouTube',
                    originalUrl: trimmed,
                    searchQuery: cleanTitle || data.title,
                    displayTitle: data.title,
                };
            }
        } catch (err) {
            console.error('⚠️ Gagal resolve YouTube URL:', err.message);
        }
    }

    // 2. Spotify Track Link
    if (/https?:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/i.test(trimmed)) {
        try {
            const res = await fetch(trimmed, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
            });
            if (res.ok) {
                const html = await res.text();
                const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
                if (titleMatch) {
                    let clean = titleMatch[1]
                        .replace(/\|\s*Spotify/gi, '')
                        .replace(/-\s*song\s*(and|&)\s*lyrics\s*by\s*/gi, ' - ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    return {
                        source: 'Spotify',
                        originalUrl: trimmed,
                        searchQuery: clean,
                        displayTitle: clean,
                    };
                }
            }
        } catch (err) {
            console.error('⚠️ Gagal resolve Spotify URL:', err.message);
        }
    }

    return null;
}

module.exports = {
    resolveExternalMusicUrl,
};
