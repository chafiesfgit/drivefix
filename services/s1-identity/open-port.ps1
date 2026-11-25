# Opens TCP port 4001 (S1 Identity) in Windows Firewall so teammates on the same Wi-Fi can reach this PC.
# Run once in PowerShell AS ADMINISTRATOR:   powershell -ExecutionPolicy Bypass -File .\open-port.ps1
$port = 4001
$name = "DriveFix S1 Identity ($port)"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Warning "Run this in PowerShell opened 'as administrator'."; exit 1 }
if (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue) {
  Write-Host "Rule already exists: $name"
} else {
  New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Private,Domain | Out-Null
  Write-Host "Opened port $port for private networks."
}
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
Write-Host "Teammates use:  http://${ip}:$port/api/v1"
