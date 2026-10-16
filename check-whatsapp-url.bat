@echo off
title Jarvis WhatsApp Webhook Status & URL Checker
color 0a

cd /d "%~dp0"
node scripts/check-whatsapp.js

pause
