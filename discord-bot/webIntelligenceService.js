const crypto = require('crypto');
const db = require('./db');

/**
 * Weather Code WMO standard to Indonesian description + emoji
 */
const WMO_WEATHER_CODES = {
    0: 'Cerah Bersih ☀️',
    1: 'Cerah Berawan 🌤️',
    2: 'Berawan Sebagian ⛅',
    3: 'Mendung Berawan ☁️',
    45: 'Berkabut 🌫️',
    48: 'Kabut Tebal 🌫️',
    51: 'Gerimis Ringan 🌦️',
    53: 'Gerimis Sedang 🌦️',
    55: 'Gerimis Lebat 🌧️',
    61: 'Hujan Ringan 🌧️',
    63: 'Hujan Sedang 🌧️',
    65: 'Hujan Lebat 🌧️⛈️',
    71: 'Salju Ringan 🌨️',
    73: 'Salju Sedang 🌨️',
    75: 'Salju Lebat ❄️',
    80: 'Hujan Rintik-Rintik 🌦️',
    81: 'Hujan Deras 🌧️',
    82: 'Hujan Badai Dahsyat ⛈️',
    95: 'Badai Petir ⛈️⚡',
    96: 'Badai Petir & Hujan Es ⛈️🧊',
    99: 'Badai Petir Dahsyat ⛈️⚡',
};

/**
 * Decode redirect URL Bing (u=a1...) ke target link asli
 */
function decodeBingUrl(url) {
    if (!url || !url.includes('/ck/a?!')) return url;
    const clean = url.replace(/&amp;/g, '&');
    const uMatch = clean.match(/[?&]u=([^&]+)/);
    if (!uMatch) return url;
    let b64 = uMatch[1];
    if (b64.startsWith('a1')) {
        b64 = b64.substring(2);
    }
    while (b64.length % 4 !== 0) {
        b64 += '=';
    }
    try {
        return Buffer.from(b64, 'base64').toString('utf-8');
    } catch {
        return url;
    }
}

/**
 * Mengambil data dari cache database jika belum kedaluwarsa
 */
async function getFromCache(queryHash) {
    try {
        const res = await db.query(
            'SELECT data FROM external_cache WHERE query_hash = $1 AND expires_at > NOW() LIMIT 1;',
            [queryHash]
        );
        if (res.rows.length > 0) {
            return res.rows[0].data;
        }
    } catch (err) {
        console.warn('⚠️ Gagal membaca cache database:', err.message);
    }
    return null;
}

/**
 * Menyimpan data ke cache database dengan TTL
 */
async function saveToCache(source, queryHash, data, ttlSeconds = 1800) {
    try {
        await db.query(
            `INSERT INTO external_cache (source, query_hash, data, expires_at, created_at)
             VALUES ($1, $2, $3, NOW() + ($4 || ' seconds')::INTERVAL, NOW())
             ON CONFLICT (query_hash) DO UPDATE
             SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at, created_at = NOW();`,
            [source, queryHash, JSON.stringify(data), ttlSeconds]
        );
    } catch (err) {
        console.warn('⚠️ Gagal menyimpan ke cache database:', err.message);
    }
}

/**
 * Melakukan pencarian web (Bing Engine + Wikipedia Fallback)
 * @param {string} query Kata kunci pencarian
 * @param {number} maxResults Maksimal hasil pencarian (default: 5)
 * @returns {Promise<Array<{ title: string, url: string, snippet: string }>>}
 */
async function searchWeb(query, maxResults = 5) {
    if (!query || !query.trim()) {
        throw new Error('Query pencarian tidak boleh kosong.');
    }

    const cleanQuery = query.trim();
    const hash = crypto.createHash('sha256').update(`search:${cleanQuery.toLowerCase()}`).digest('hex');

    // 1. Cek Cache DB (TTL: 30 menit)
    const cached = await getFromCache(hash);
    if (cached) {
        return cached;
    }

    try {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(cleanQuery)}&FORM=QBRE`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'id,en-US;q=0.8,en;q=0.5',
            },
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const html = await res.text();
        const results = [];

        // Parsing blok b_algo di Bing
        const items = html.split('<li class="b_algo"').slice(1);

        for (const item of items) {
            if (results.length >= maxResults) break;

            const h2Match = item.match(/<h2>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
            const snippetMatch = item.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

            if (h2Match) {
                const rawUrl = h2Match[1];
                const realUrl = decodeBingUrl(rawUrl);
                const title = h2Match[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
                const snippet = snippetMatch
                    ? snippetMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim()
                    : '';

                if (realUrl && realUrl.startsWith('http') && title) {
                    results.push({
                        title: title,
                        url: realUrl,
                        snippet: snippet,
                    });
                }
            }
        }

        // Jika berhasil dapat hasil, simpan ke cache
        if (results.length > 0) {
            await saveToCache('web_search', hash, results, 1800); // 30 menit
            return results;
        }
    } catch (err) {
        console.warn(`⚠️ Pencarian web Bing gagal (${err.message}), mencoba fallback Wikipedia...`);
    }

    // Fallback: Wikipedia OpenSearch API
    try {
        const wikiUrl = `https://id.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanQuery)}&limit=${maxResults}&namespace=0&format=json`;
        const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(5000) });
        const wikiData = await wikiRes.json();

        const results = [];
        const titles = wikiData[1] || [];
        const snippets = wikiData[2] || [];
        const links = wikiData[3] || [];

        for (let i = 0; i < titles.length; i++) {
            if (links[i] && titles[i]) {
                results.push({
                    title: titles[i],
                    url: links[i],
                    snippet: snippets[i] || `Artikel ensiklopedia Wikipedia tentang ${titles[i]}.`,
                });
            }
        }

        if (results.length > 0) {
            await saveToCache('web_search', hash, results, 1800);
            return results;
        }
    } catch (_) {}

    return [];
}

/**
 * Mengambil dan mengekstrak teks utama dari sebuah halaman web / artikel URL
 * @param {string} targetUrl URL halaman web
 * @returns {Promise<{ title: string, content: string, url: string }>}
 */
async function fetchAndExtractUrl(targetUrl) {
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl.trim())) {
        throw new Error('URL tidak valid. Mohon sertakan tautan lengkap yang diawali http:// atau https://');
    }

    const cleanUrl = targetUrl.trim();
    const hash = crypto.createHash('sha256').update(`extract:${cleanUrl}`).digest('hex');

    // 1. Cek Cache DB (TTL: 2 jam)
    const cached = await getFromCache(hash);
    if (cached) {
        return cached;
    }

    try {
        const res = await fetch(cleanUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
            throw new Error(`Gagal membuka halaman: HTTP ${res.status}`);
        }

        const html = await res.text();

        // 1. Ekstrak judul <title>
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').replace(/&amp;/g, '&').trim() : 'Tanpa Judul';

        // 2. Bersihkan tag skrip, styling, navigasi, footer
        let cleanHtml = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[\s\S]*?<\/header>/gi, '')
            .replace(/<svg[\s\S]*?<\/svg>/gi, '')
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

        // 3. Ekstrak isi teks paragraf (<p> dan <h1>-<h3>)
        const textMatches = cleanHtml.match(/<(p|h1|h2|h3|article)[^>]*>([\s\S]*?)<\/\1>/gi) || [];
        let extractedText = '';

        for (const block of textMatches) {
            const rawText = block.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
            if (rawText.length > 20) {
                extractedText += rawText + '\n\n';
            }
            if (extractedText.length >= 2500) {
                break;
            }
        }

        // Jika paragraf kosong atau sangat pendek, coba meta description & body bersih
        if (extractedText.length < 100) {
            const metaDescMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description|twitter:description)["'][^>]+content=["']([^"']+)["']/i) ||
                                  html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description|twitter:description)["']/i);
            if (metaDescMatch && metaDescMatch[1].trim()) {
                extractedText += metaDescMatch[1].trim() + '\n\n';
            }
            const bodyFallback = cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 1500);
            if (bodyFallback.length > extractedText.length) {
                extractedText = bodyFallback;
            }
        }

        // Jika halaman ternyata SPA kosong (seperti MSN / React tanpa SSR), fallback cari info artikel lewat slug URL
        let finalTitle = title;
        if (extractedText.length < 60 || finalTitle === 'MSN' || finalTitle === 'Tanpa Judul') {
            const urlParts = cleanUrl.split(/[/?#]/).filter(Boolean);
            const slugCandidates = urlParts
                .filter((p) => !p.startsWith('http') && !p.includes('.') && p.length >= 8 && !/^[0-9]+$/.test(p))
                .sort((a, b) => b.length - a.length);

            const rawSlug = slugCandidates[0] || '';
            const cleanSlug = decodeURIComponent(rawSlug)
                .replace(/[-_]/g, ' ')
                .replace(/\b(ar-[a-z0-9]+|html|php|aspx?)\b/gi, '')
                .trim();

            if (cleanSlug.length >= 8) {
                try {
                    const fallbackSearch = await searchWeb(cleanSlug, 3);
                    if (fallbackSearch && fallbackSearch.length > 0) {
                        finalTitle = fallbackSearch[0].title || cleanSlug;
                        extractedText = `(Halaman web memuat konten dinamis JavaScript. Rangkuman diekstrak dari indeks web):\n\n` +
                            fallbackSearch.map((s, idx) => `${idx + 1}. ${s.title}: ${s.snippet}`).join('\n\n');
                    }
                } catch (_) {}
            }
        }

        const result = {
            title: finalTitle,
            content: extractedText.trim(),
            url: cleanUrl,
        };

        // Simpan ke cache (2 jam)
        await saveToCache('web_extract', hash, result, 7200);

        return result;
    } catch (err) {
        throw new Error(`Gagal membaca isi web (${err.message}). Pastikan link bisa diakses publik.`);
    }
}

/**
 * Helper pembersih & pembuat variasi nama kota untuk geocoding Open-Meteo
 */
function getCitySearchCandidates(input) {
    if (!input || !input.trim()) return ['Jakarta'];

    const raw = input.trim();
    const candidates = [];

    // 1. Alias umum Indonesia
    const ALIASES = {
        'bali': 'Denpasar',
        'jogja': 'Yogyakarta',
        'diy': 'Yogyakarta',
        'dki': 'Jakarta',
        'jaksel': 'Jakarta',
        'jakbar': 'Jakarta',
        'jakpus': 'Jakarta',
        'jaktim': 'Jakarta',
        'jakut': 'Jakarta',
    };

    const lower = raw.toLowerCase();
    if (ALIASES[lower]) {
        candidates.push(ALIASES[lower]);
    }

    // 2. Input asli
    candidates.push(raw);

    // 3. Bersihkan kata tambahan seperti kota, kab, kabupaten, kotamadya, arah mata angin
    const cleaned = raw
        .replace(/\b(kota|kabupaten|kab|kotamadya|wilayah|daerah|provinsi|propinsi|area)\b/gi, '')
        .replace(/\b(selatan|utara|barat|timur|pusat|tengah)\b/gi, '')
        .trim();

    if (cleaned && cleaned !== raw) {
        candidates.push(cleaned);
        candidates.push(`Kota ${cleaned}`);
    }

    // 4. Jika ada multi kata, coba kata pertama (contoh: "madiun kota" -> "madiun", "surabaya barat" -> "surabaya")
    const firstWord = raw.split(/\s+/)[0];
    if (firstWord && !candidates.includes(firstWord)) {
        candidates.push(firstWord);
    }

    return [...new Set(candidates)];
}

/**
 * Mengambil data cuaca real-time menggunakan Open-Meteo API
 * @param {string} cityName Nama kota (contoh: 'Jakarta', 'Bandung', 'Surabaya', 'Madiun Kota')
 * @returns {Promise<object>} Data cuaca
 */
async function getWeather(cityName = 'Jakarta') {
    const cleanCity = (cityName || 'Jakarta').trim();
    const hash = crypto.createHash('sha256').update(`weather:${cleanCity.toLowerCase()}`).digest('hex');

    // 1. Cek Cache DB (TTL: 15 menit)
    const cached = await getFromCache(hash);
    if (cached) {
        return cached;
    }

    try {
        // Step 1: Geocoding Kota dengan multi-candidate fallback
        const candidates = getCitySearchCandidates(cleanCity);
        let location = null;

        for (const cand of candidates) {
            try {
                const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cand)}&count=5&language=id&format=json`;
                const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(6000) });
                if (!geoRes.ok) continue;
                const geoData = await geoRes.json();
                if (geoData.results && geoData.results.length > 0) {
                    // Prioritaskan hasil yang berada di Indonesia (ID)
                    const idResult = geoData.results.find((r) => r.country_code === 'ID');
                    location = idResult || geoData.results[0];
                    break;
                }
            } catch (_) {}
        }

        if (!location) {
            throw new Error(`Kota "${cleanCity}" tidak ditemukan. Coba gunakan nama kota besar terdekat.`);
        }

        const { latitude, longitude, name, country, admin1 } = location;

        // Step 2: Mengambil data cuaca terkini
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`;
        const weatherRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(6000) });
        if (!weatherRes.ok) throw new Error(`Weather API HTTP ${weatherRes.status}`);
        const weatherData = await weatherRes.json();

        const current = weatherData.current;
        const weatherDesc = WMO_WEATHER_CODES[current.weather_code] || 'Cerah Berawan 🌤️';

        const result = {
            city: name,
            region: admin1 || '',
            country: country || 'Indonesia',
            latitude,
            longitude,
            temperature: Math.round(current.temperature_2m),
            feelsLike: Math.round(current.apparent_temperature),
            humidity: current.relative_humidity_2m,
            weatherCode: current.weather_code,
            weatherDescription: weatherDesc,
            windSpeed: current.wind_speed_10m,
            precipitation: current.precipitation,
            updatedAt: current.time,
        };

        // Simpan ke cache (15 menit)
        await saveToCache('weather', hash, result, 900);

        return result;
    } catch (err) {
        throw new Error(`Gagal mengambil data cuaca: ${err.message}`);
    }
}

module.exports = {
    searchWeb,
    fetchAndExtractUrl,
    getWeather,
};
