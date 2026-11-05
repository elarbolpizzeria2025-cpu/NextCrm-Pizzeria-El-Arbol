$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$batPath = Join-Path $projectDir "start-printer-bridge.bat"
$startup = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startup "NextCRM Printer Bridge.lnk"

$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $batPath
$shortcut.WorkingDirectory = $projectDir
$shortcut.WindowStyle = 7
$shortcut.Description = "Inicia el puente local de impresoras de NextCRM"
$shortcut.Save()

Write-Host ""
Write-Host "NextCRM Printer Bridge configurado para iniciar con Windows." -ForegroundColor Green
Write-Host "Acceso creado en: $shortcutPath"
Write-Host ""
