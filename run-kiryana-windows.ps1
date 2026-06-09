# Wrapper to start Kiryana POS server in a new window and open browser when ready
Write-Host "Starting Kiryana POS (background window)..." -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $repoRoot "start-kiryana.ps1"

if (-not (Test-Path $startScript)) {
    Write-Host "Could not find $startScript" -ForegroundColor Red
    exit 1
}

# Start the main start script in a new PowerShell window (use array for ArgumentList)
Start-Process -FilePath "powershell.exe" -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$startScript) -WindowStyle Normal

# Wait for server to become available
$uri = 'http://localhost:3000/'
$timeoutSeconds = 60
$endTime = (Get-Date).AddSeconds($timeoutSeconds)
Write-Host "Waiting for $uri to be available..." -ForegroundColor Yellow
while ((Get-Date) -lt $endTime) {
    try {
        $r = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -ge 200) {
            Write-Host "Server is up, opening browser..." -ForegroundColor Green
            Start-Process $uri
            exit 0
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

Write-Host "Timed out waiting for server; opening browser anyway." -ForegroundColor Yellow
Start-Process $uri
exit 0
