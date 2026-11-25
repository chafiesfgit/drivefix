# DriveFix contract check (Windows wrapper).
# Example:  .\check.ps1 -Service s2 -Url http://192.168.1.20:4002/api/v1 -S1 http://192.168.1.10:4001/api/v1
#           .\check.ps1 -Service s2 -Write      (also runs the "Done when" scenario; re-seed afterwards)
param(
  [Parameter(Mandatory = $true)][ValidateSet('s1', 's2', 's3', 's4', 's5', 's6')][string]$Service,
  [string]$Url,
  [string]$S1 = 'http://localhost:4001/api/v1',
  [switch]$Write,
  [string]$Out = 'contract-check-report.md'
)
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Error 'Node.js 18+ is required: https://nodejs.org'; exit 2 }
if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules'))) { npm install --no-audit --no-fund | Out-Null }
$argsList = @('bin/contract-check.mjs', '--service', $Service, '--s1', $S1, '--out', $Out)
if ($Url) { $argsList += @('--url', $Url) }
if ($Write) { $argsList += '--write' }
& node @argsList
exit $LASTEXITCODE
