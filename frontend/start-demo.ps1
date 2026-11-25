# Starts the DriveFix demo: S1 Identity (port 4001) + frontend (port 5173), each in its own window.
# Usage (from anywhere):  powershell -ExecutionPolicy Bypass -File .\frontend\start-demo.ps1
# Any old node/python process still holding port 4001 or 5173 is stopped first ("Port 5173 is already in use").

$ErrorActionPreference = 'Stop'
$frontend = $PSScriptRoot
$s1 = Join-Path (Split-Path $frontend -Parent) 'services\s1-identity'

function Stop-PortOwner([int]$port) {
  $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $owners) {
    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($p -and $p.ProcessName -in @('node', 'python', 'py')) {
      Write-Host "Port $port is held by $($p.ProcessName) (PID $procId), stopping it."
      Stop-Process -Id $procId -Force
    } elseif ($p) {
      Write-Warning "Port $port is used by $($p.ProcessName) (PID $procId). Close it yourself, then run this again."
      exit 1
    }
  }
}

Stop-PortOwner 4001
Stop-PortOwner 5173
Start-Sleep -Milliseconds 500

if (-not (Test-Path (Join-Path $s1 '.venv'))) {
  Write-Warning "S1 is not set up yet. Run once:  cd `"$s1`" ; powershell -ExecutionPolicy Bypass -File .\setup.ps1"
  exit 1
}
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
  Write-Host 'Installing frontend packages (first run)...'
  Push-Location $frontend; npm install; Pop-Location
}

# OTP codes are printed in the S1 window.
Start-Process powershell -WorkingDirectory $s1 -ArgumentList '-NoExit', '-Command', "`$host.UI.RawUI.WindowTitle='DriveFix S1 :4001 (OTP codes here)'; .\run.ps1"
Start-Process powershell -WorkingDirectory $frontend -ArgumentList '-NoExit', '-Command', "`$host.UI.RawUI.WindowTitle='DriveFix frontend :5173'; npm run dev"

Write-Host ''
Write-Host 'Starting... open http://localhost:5173 in a few seconds.'
Write-Host 'Demo accounts: 0555000001 (admin) ... 0555000010 (dispatcher), password Password123'
