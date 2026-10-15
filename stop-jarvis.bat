@echo off
title Stop Jarvis / Amba Bot (All-in-One Docker) - By kicenzeus
color 0c

echo ===================================================================
echo             MENGHENTIKAN SELURUH SERVICE JARVIS
echo                     Developed by: kicenzeus
echo ===================================================================
echo.

cd /d "%~dp0"
echo Menghentikan seluruh container Jarvis (Postgres, n8n, Discord Bot)...
docker compose stop

echo.
echo ===================================================================
echo  SEMUA CONTAINER BERHASIL DIHENTIKAN!
echo  Untuk menyalakan kembali, cukup jalankan start-jarvis.bat
echo ===================================================================
echo.
pause
