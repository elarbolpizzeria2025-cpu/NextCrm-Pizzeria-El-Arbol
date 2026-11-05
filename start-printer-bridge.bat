@echo off
title NextCRM - Puente de Impresoras
cd /d "%~dp0"
echo.
echo ==========================================
echo  NEXTCRM - PUENTE DE IMPRESORAS
echo  Impresora anterior Windows + UN-TP95W
echo ==========================================
echo.
echo No cierre esta ventana mientras use el POS.
echo.
npm run printer:bridge
pause
