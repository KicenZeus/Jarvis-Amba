@echo off
title Jarvis Amba - Multi-Channel Broadcast
cls
if "%BOT_URL%"=="" set "BOT_URL=https://jarvis-amba-production.up.railway.app"
node "%~dp0scripts\broadcast.js" %*
pause
