@echo off
setlocal
title NextCRM - Instalador del Puente de Impresion
set "DIR=%LOCALAPPDATA%\NextCRMPrinterBridge"
set "PS1=%DIR%\nextcrm-printer-bridge.ps1"
set "URL=https://el-arbol-alpha.vercel.app/nextcrm-printer-bridge.ps1"

echo.
echo ===============================================
echo  NEXTCRM - INSTALADOR PUENTE DE IMPRESION
echo ===============================================
echo.
echo Instalando en:
echo %DIR%
echo.

if not exist "%DIR%" mkdir "%DIR%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -OutFile '%PS1%'"
if errorlevel 1 (
  echo.
  echo ERROR: No se pudo descargar el puente.
  echo Revise la conexion a Internet e intente nuevamente.
  pause
  exit /b 1
)

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\NextCRM-Printer-Bridge.cmd"
> "%STARTUP%" echo @echo off
>> "%STARTUP%" echo powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "%PS1%"

echo.
echo Puente instalado correctamente.
echo Se iniciara automaticamente con Windows.
echo.
echo Iniciando ahora...
start "NextCRM Printer Bridge" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%"

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:18181/health"

echo.
echo Si el navegador muestra {"ok":true}, ya esta funcionando.
echo Vuelva al CRM y toque DETECTAR.
echo.
pause
