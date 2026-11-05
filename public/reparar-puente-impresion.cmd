@echo off
setlocal
title NextCRM - Reparar Puente de Impresion
set "DIR=%LOCALAPPDATA%\NextCRMPrinterBridge"
set "PS1=%DIR%\nextcrm-printer-bridge.ps1"
set "URL=https://el-arbol-alpha.vercel.app/nextcrm-printer-bridge.ps1"

echo.
echo ===============================================
echo  NEXTCRM - REPARAR PUENTE DE IMPRESION
echo ===============================================
echo.

if not exist "%DIR%" mkdir "%DIR%"

echo Cerrando versiones anteriores del puente...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*nextcrm-printer-bridge.ps1*' -and $_.ProcessId -ne $PID }; foreach($p in $procs){ try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } catch{} }"

echo Descargando la ultima version...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -OutFile '%PS1%'"
if errorlevel 1 (
  echo.
  echo ERROR: No se pudo descargar el puente.
  pause
  exit /b 1
)

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\NextCRM-Printer-Bridge.cmd"
> "%STARTUP%" echo @echo off
>> "%STARTUP%" echo powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "%PS1%"

echo Iniciando puente...
start "NextCRM Printer Bridge" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%"

timeout /t 3 /nobreak >nul

echo.
echo Abriendo comprobacion...
start "" "http://127.0.0.1:18181/health"

echo.
echo Si el navegador muestra {"ok":true}, el puente esta reparado.
echo Luego vuelva al CRM: Gestion > Caja > Impresora anterior.
echo Use XP-80C, Guardar e Imprimir prueba.
echo.
pause
