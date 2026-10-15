@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   JARVIS V2 DATABASE RESTORE UTILITY (Phase 8)
echo ===================================================

if "%~1"=="" (
    echo [!] Penggunaan: restore-db.bat ^<nama_file_backup.sql^>
    echo     Contoh: restore-db.bat backup_jarvis_sample.sql
    echo.
    echo Daftar file backup yang tersedia di folder ini:
    dir /b "%~dp0*.sql"
    echo.
    pause
    exit /b 1
)

set BACKUP_TARGET=%~1
if not exist "%BACKUP_TARGET%" (
    if exist "%~dp0%BACKUP_TARGET%" (
        set BACKUP_TARGET=%~dp0%BACKUP_TARGET%
    ) else (
        echo [!] ERROR: File backup "%BACKUP_TARGET%" tidak ditemukan!
        pause
        exit /b 1
    )
)

set DOCKER_CONTAINER=jarvis-postgres
set DB_USER=jarvis
set DB_NAME=jarvis

echo [!] PERINGATAN: Aksi ini akan menimpa data di database %DB_NAME%!
set /p CONFIRM="Lanjutkan proses restore? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo [*] Restore dibatalkan.
    pause
    exit /b 0
)

echo [*] Melakukan restore database dari %BACKUP_TARGET%...
docker exec -i %DOCKER_CONTAINER% psql -U %DB_USER% -d %DB_NAME% < "%BACKUP_TARGET%"

if errorlevel 0 (
    echo.
    echo [OK] Database berhasil dipulihkan dari backup.
    echo ===================================================
) else (
    echo.
    echo [!] Gagal memulihkan database.
)

pause
