@echo off
chcp 65001 >nul
title ระบบนัดจองคิวทันตกรรมออนไลน์ (Dental Booking System)
echo ==========================================================
echo  ระบบนัดจองคิวทันตกรรมออนไลน์ (Dental Booking System)
echo ==========================================================
echo  กำลังเริ่มต้นเว็บเซิร์ฟเวอร์...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8080
pause
