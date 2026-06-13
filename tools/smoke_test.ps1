$endpoints = @(
  'http://localhost:3000/api/products?limit=1',
  'http://localhost:3000/api/products?lowStock=true',
  'http://localhost:3000/api/reports/daily-sales',
  'http://localhost:3000/api/customers',
  'http://localhost:3000/api/reports/monthly-pnl',
  'http://localhost:3000/api/reports/stock-summary',
  'http://localhost:3000/api/reports/date-range-sales?from=2026-06-01&to=2026-06-13',
  'http://localhost:3000/api/settings/shopName',
  'http://localhost:3000/api/settings/gst',
  'http://localhost:3000/api/settings/lowStockThreshold',
  'http://localhost:3000/api/settings/barcodeScannerEnabled',
  'http://localhost:3000/api/settings/printerEnabled',
  'http://localhost:3000/api/settings/backupEnabled',
  'http://localhost:3000/api/settings/backupFrequency',
  'http://localhost:3000/api/settings/backupLocation',
  'http://localhost:3000/api/settings/backupCustom',
  'http://localhost:3000/api/backup/list'
)

foreach ($u in $endpoints) {
  try {
    $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 10
    Write-Output "$u => $($r.StatusCode)"
  } catch {
    if ($_.Exception.Response) {
      try { $code = $_.Exception.Response.StatusCode.value__ } catch { $code = $_.Exception.Response.StatusCode }
      Write-Output "$u => ERROR $code"
    } else {
      Write-Output "$u => ERROR - $($_.Exception.Message)"
    }
  }
}
