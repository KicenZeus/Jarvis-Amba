FROM node:20-bookworm-slim

# Install dependencies sistem (ffmpeg untuk audio streaming, python3 & curl untuk yt-dlp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    tzdata \
    python3 \
    curl \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/*

# Set timezone default
ENV TZ=Asia/Jakarta

WORKDIR /app

# Salin package.json dan install dependency produksi
COPY package*.json ./
RUN npm install --omit=dev

# Salin seluruh source code bot
COPY . .

# Buat folder temp_audio jika belum ada
RUN mkdir -p temp_audio

# Port untuk notifikasi internal scheduler (dari n8n)
EXPOSE 5001

CMD ["node", "bot.js"]
