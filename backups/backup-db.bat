@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   JARVIS V2 DATABASE BACKUP UTILITY (Phase 8)
echo ===================================================

set DOCKER_CONTAINER=jarvis-postgres
set DB_USER=jarvis
set DB_NAME=jarvis
set TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_FILE=backups\backup_jarvis_%TIMESTAMP%.sql

echo [*] Memeriksa status container %DOCKER_CONTAINER%...
docker ps | findstr /i "%DOCKER_CONTAINER%" >nul
if errorlevel 1 (
    echo [!] ERROR: Container %DOCKER_CONTAINER% sedang tidak berjalan.
    echo     Jalankan "docker compose up -d postgres" terlebih dahulu.
    pause
    exit /b 1
)

echo [*] Membuat snapshot cadangan ke %BACKUP_FILE%...
docker exec -t %DOCKER_CONTAINER% pg_dump -U %DB_USER% -d %DB_NAME% --clean --if-exists > "%~dp0backup_jarvis_%TIMESTAMP%.sql"

if errorlevel 0 (
    echo.
    echo [OK] Backup database berhasil dibuat:
    echo      %~dp0backup_jarvis_%TIMESTAMP%.sql
    echo ===================================================
) else (
    echo.
    echo [!] Gagal membuat backup database.
)

pause
