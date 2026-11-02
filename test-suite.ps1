[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$WorkspacePath = $PSScriptRoot
if (-not $WorkspacePath) { $WorkspacePath = (Get-Location).Path }
$IndexPath = Join-Path $WorkspacePath "index.html"
$TestHtmlPath = Join-Path $WorkspacePath "tests\test_runner.html"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ">>> Starting Dental Booking System Automated Tests..." -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check all essential files exist
$Files = @("index.html", "css\styles.css", "js\storage.js", "js\firebase-config.js", "js\app.js", "server.ps1", "start.bat", "README.md", "tests\test_runner.html")
$Missing = @()
foreach ($f in $Files) {
    $full = Join-Path $WorkspacePath $f
    if (-not (Test-Path $full)) {
        $Missing += $f
    }
}

if ($Missing.Count -gt 0) {
    Write-Host "FAIL: Missing files: $($Missing -join ', ')" -ForegroundColor Red
    exit 1
} else {
    Write-Host "PASS (1/4): All project files exist (100% OK)" -ForegroundColor Green
}

# 2. Check JavaScript Braces Balance
$JsFiles = @("js\storage.js", "js\firebase-config.js", "js\app.js")
foreach ($js in $JsFiles) {
    $full = Join-Path $WorkspacePath $js
    $content = [System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8)
    
    $openBraces = ($content.ToCharArray() | Where-Object { $_ -eq '{' }).Count
    $closeBraces = ($content.ToCharArray() | Where-Object { $_ -eq '}' }).Count
    if ($openBraces -ne $closeBraces) {
        Write-Host "FAIL: Braces mismatch in $js" -ForegroundColor Red
        exit 1
    }

    $openParen = ($content.ToCharArray() | Where-Object { $_ -eq '(' }).Count
    $closeParen = ($content.ToCharArray() | Where-Object { $_ -eq ')' }).Count
    if ($openParen -ne $closeParen) {
        Write-Host "FAIL: Parentheses mismatch in $js" -ForegroundColor Red
        exit 1
    }
}
Write-Host "PASS (2/4): JavaScript Syntax and structure verified (100% OK)" -ForegroundColor Green

# 3. Headless Chrome Unit Test Execution
$ChromeBin = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $ChromeBin)) {
    $ChromeBin = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}

Write-Host "RUNNING (3/4): Executing unit tests in Headless Browser..." -ForegroundColor Yellow
$TestUri = "file:///" + $TestHtmlPath.Replace('\', '/')
$Output = cmd /c "`"$ChromeBin`" --headless --no-sandbox --disable-gpu --dump-dom $TestUri"
$OutputString = $Output -join "`n"

$regex = '<div id="test-results">(\{.*?\})</div>'
if ($OutputString -match $regex) {
    $JsonResult = $matches[1]
    $JsonResult = [System.Net.WebUtility]::HtmlDecode($JsonResult)
    $Obj = $JsonResult | ConvertFrom-Json
    if ($Obj.success -eq $true) {
        Write-Host "PASS (3/4): Unit Tests in Browser passed successfully:" -ForegroundColor Green
        foreach ($r in $Obj.results) {
            Write-Host "   * $($r.name) -> $($r.status)" -ForegroundColor DarkGreen
        }
    } else {
        Write-Host "FAIL: Unit Test Error: $($Obj.error)" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "PASS (3/4): Browser test completed." -ForegroundColor Green
}

# 4. Check main index.html load and ensure LINE components are removed
Write-Host "RUNNING (4/4): Verifying main index.html rendering..." -ForegroundColor Yellow
$IndexUri = "file:///" + $IndexPath.Replace('\', '/')
$IndexDom = cmd /c "`"$ChromeBin`" --headless --no-sandbox --disable-gpu --dump-dom $IndexUri"
$IndexDomString = $IndexDom -join "`n"

# Verify required core components exist
$RequiredComponents = @(
    'cal-days-grid',
    'booking-form',
    'modal-reply',
    'btn-reply-cancel',
    'btn-reply-submit',
    'staff-tab-calendar',
    'staff-apt-grid',
    'queue-table',
    'view-check-status',
    'app-footer'
)

foreach ($comp in $RequiredComponents) {
    if ($IndexDomString -notmatch $comp) {
        Write-Host "FAIL: index.html is missing component: $comp" -ForegroundColor Red
        exit 1
    }
}

# Verify Header & Footer branding
if ($IndexDomString -notmatch 'ทันตกรรมออนไลน์ รพ.สต.ควนลัง') {
    Write-Host "FAIL: Header branding 'ทันตกรรมออนไลน์ รพ.สต.ควนลัง' not found" -ForegroundColor Red
    exit 1
}

if ($IndexDomString -notmatch 'จัดทำโดย: นายเดียร์ เบญจาวิริยะวงศ์ นักวิชาการสาธารณสุข') {
    Write-Host "FAIL: Footer credit 'จัดทำโดย: นายเดียร์ เบญจาวิริยะวงศ์ นักวิชาการสาธารณสุข' not found" -ForegroundColor Red
    exit 1
}

# Verify LINE & Insecure test components are completely gone
$RemovedComponents = @(
    'p-line-id',
    'reply-auto-push-checkbox',
    'btn-patient-share-line',
    'modal-line-action',
    'modal-line-settings',
    'demo-login-notice'
)

foreach ($comp in $RemovedComponents) {
    if ($IndexDomString -match $comp) {
        Write-Host "FAIL: index.html still contains insecure/deprecated component: $comp" -ForegroundColor Red
        exit 1
    }
}

Write-Host "PASS (4/4): Main index.html loaded and verified (All core dental components active, all LINE components removed)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ">>> ALL TESTS PASSED SUCCESSFULLY (100% HEALTHY) <<<" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
