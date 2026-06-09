param(
    [string]$InstallPath = $(Split-Path -Parent $MyInvocation.MyCommand.Path)
)

$backupRoot = Join-Path $InstallPath 'backups'
if (-not (Test-Path $backupRoot)) {
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
}

$timestamp = (Get-Date).ToString('yyyy-MM-dd_HH-mm-ss')
$backupTarget = Join-Path $backupRoot $timestamp

# Use robocopy to exclude the backup folder and avoid recursion
$source = $InstallPath
$dest = $backupTarget
$excludeDirs = 'backups'

New-Item -ItemType Directory -Path $dest -Force | Out-Null
$robocopyArgs = @($source, $dest, '*.*', '/E', '/XD', $excludeDirs, '/R:1', '/W:1', '/NFL', '/NDL')
$process = Start-Process -FilePath 'robocopy.exe' -ArgumentList $robocopyArgs -NoNewWindow -Wait -PassThru
if ($process.ExitCode -ge 8) {
    throw "Backup failed with Robocopy exit code $($process.ExitCode)"
}
