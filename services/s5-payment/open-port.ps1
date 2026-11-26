# Open port 4005 in Windows Firewall so other PCs on the Wi-Fi can reach S5.
# Run in PowerShell AS ADMINISTRATOR.
New-NetFirewallRule -DisplayName "DriveFix S5 (4005)" -Direction Inbound -Protocol TCP -LocalPort 4005 -Action Allow -Profile Private,Domain
