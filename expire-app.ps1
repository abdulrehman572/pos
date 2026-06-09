param(
    [string]$InstallPath = $(Split-Path -Parent $MyInvocation.MyCommand.Path),
    [int]$Days = 7
)

$installDateFile = Join-Path $InstallPath 'install-date.txt'
$backupRoot = Join-Path $InstallPath 'backups'

if (Test-Path $installDateFile) {
    $installDate = Get-Date (Get-Content $installDateFile -ErrorAction SilentlyContinue)
} else {
    $installDate = (Get-Date (Get-Item $InstallPath).CreationTime)
}

if ((Get-Date) -lt $installDate.AddDays($Days)) {
    exit 0
}

# Delete everything except backups folder
Get-ChildItem -Path $InstallPath -Force | ForEach-Object {
    if ($_.FullName -ne $backupRoot) {
        try {
            Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
        } catch {
            # ignore
        }
    }
}

# Preserve backups folder only
