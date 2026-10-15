@echo off
title Jarvis / Amba Bot Launcher (All-in-One Docker) - By kicenzeus
color 0b

echo ===================================================================
echo           JARVIS / AMBA DISCORD BOT (ALL-IN-ONE DOCKER)
echo                     Developed by: kicenzeus
echo ===================================================================
echo.

:: 1. Cek apakah Docker berjalan
echo [1/2] Memeriksa status Docker Desktop...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [PERINGATAN] Docker Engine / Docker Desktop belum berjalan!
    echo Silakan buka aplikasi Docker Desktop di Windows terlebih dahulu,
    echo lalu jalankan script ini kembali.
    echo.
    pause
    exit /b 1
)
echo [OK] Docker Desktop aktif.
echo.

:: 2. Jalankan Seluruh Stack (Postgres, n8n, dan Discord Bot)
echo [2/2] Menyalakan seluruh service Jarvis (Postgres, n8n, Discord Bot)...
cd /d "%~dp0"
docker compose up -d

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gagal menjalankan docker compose!
    pause
    exit /b 1
)

echo.
echo ===================================================================
echo  SEMUA SERVICE JARVIS BERHASIL DINYALAKAN DALAM DOCKER!
echo ===================================================================
echo.
echo Menampilkan status container:
docker compose ps
echo.
echo Menampilkan 10 log terakhir Discord Bot:
docker logs --tail 10 jarvis-bot
echo.
echo ===================================================================
echo  Bot Amba sudah ONLINE di Discord!
echo  Jendela ini boleh Anda tutup kapan saja (bot tetap jalan di background).
echo  Untuk mematikan, cukup jalankan stop-jarvis.bat atau via Docker Desktop.
echo ===================================================================
echo.
pause
