# Contract check for S4. S1 must be running: the checker logs in there to mint test tokens;
# S4 itself never calls S1. -Write runs the "Done when" scenario and changes demo data -> re-seed after.
param([switch]$Write)
Set-Location $PSScriptRoot
$params = @('-Service', 's4')
if ($Write) { $params += '-Write' }
& ..\..\tools\contract-check\check.ps1 @params
$code = $LASTEXITCODE
if ($Write) { & .\.venv\Scripts\python.exe manage.py seed --reset }
exit $code
