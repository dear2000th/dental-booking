# Dental Booking System - Lightweight PowerShell Web Server
# Serves static files and allows mobile devices on local network to connect

param (
    [int]$Port = 8080
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RootPath = $PSScriptRoot
if (-not $RootPath) { $RootPath = (Get-Location).Path }

# 1. Port binding with automatic fallback if port is already in use
$Listener = $null
$BoundPort = $Port
for ($p = $Port; $p -le ($Port + 10); $p++) {
    try {
        $HostAddress = [System.Net.IPAddress]::Any
        $Listener = New-Object System.Net.Sockets.TcpListener($HostAddress, $p)
        $Listener.Start()
        $BoundPort = $p
        break
    } catch {
        Write-Host "Port $p is currently busy, trying next port..." -ForegroundColor Yellow
    }
}

if (-not $Listener) {
    Write-Host "ERROR: Could not bind to any port between $Port and $($Port + 10)." -ForegroundColor Red
    exit 1
}

# 2. Get local IP for mobile access
$LocalIP = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127*" -and $_.IPAddress -notlike "169*" } | Select-Object -First 1).IPAddress
if (-not $LocalIP) { $LocalIP = "localhost" }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " ระบบนัดจองคิวทันตกรรมออนไลน์ (Dental Booking System)" -ForegroundColor Green
Write-Host " เว็บเซิร์ฟเวอร์เปิดทำงานเรียบร้อยแล้ว!" -ForegroundColor Yellow
Write-Host ""
Write-Host " [คอมพิวเตอร์นี้]  : http://localhost:$BoundPort" -ForegroundColor White
Write-Host " [โทรศัพท์มือถือ] : http://${LocalIP}:$BoundPort (ต่อ Wi-Fi เดียวกัน)" -ForegroundColor Cyan
Write-Host ""
Write-Host " กำลังเปิดเว็บเบราว์เซอร์อัตโนมัติ..." -ForegroundColor Green
Write-Host " กด Ctrl+C เพื่อหยุดการทำงานของเซิร์ฟเวอร์" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# 3. Automatically open browser to the guaranteed active server
try {
    Start-Process "http://localhost:$BoundPort"
} catch {}

function Get-MimeType($path) {
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    switch ($ext) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".svg"  { return "image/svg+xml" }
        ".ico"  { return "image/x-icon" }
        default { return "application/octet-stream" }
    }
}

# 4. Main Connection Loop with Resilient Exception Isolation
try {
    while ($true) {
        $Client = $null
        try {
            $Client = $Listener.AcceptTcpClient()
            $Stream = $Client.GetStream()
            $Reader = New-Object System.IO.StreamReader($Stream, [System.Text.Encoding]::UTF8)
            $Writer = New-Object System.IO.StreamWriter($Stream, [System.Text.Encoding]::UTF8)

            $RequestLine = $Reader.ReadLine()
            if (-not $RequestLine) {
                if ($Client) { $Client.Close() }
                continue
            }

            $Parts = $RequestLine.Split(' ')
            $Method = $Parts[0].ToUpper()
            $Url = $Parts[1]

            # Read remaining headers and get Content-Length
            $ContentLength = 0
            while ($line = $Reader.ReadLine()) {
                if ($line.ToLower().StartsWith("content-length:")) {
                    $ContentLength = [int]($line.Split(':')[1].Trim())
                }
                if ($line.Trim() -eq "") { break }
            }

            # A. Handle CORS Preflight (OPTIONS)
            if ($Method -eq "OPTIONS") {
                $Header = "HTTP/1.1 204 No Content`r`n" +
                          "Access-Control-Allow-Origin: *`r`n" +
                          "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n" +
                          "Access-Control-Allow-Headers: Content-Type, Authorization`r`n" +
                          "Access-Control-Max-Age: 86400`r`n" +
                          "Content-Length: 0`r`n" +
                          "Connection: close`r`n`r`n"
                $HeaderBytes = [System.Text.Encoding]::UTF8.GetBytes($Header)
                $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
                $Writer.Flush()
                $Client.Close()
                continue
            }

            # B. Handle Static Files
            $FilePath = $Url.Split('?')[0].TrimStart('/')
            if ($FilePath -eq "" -or $FilePath -eq "/") { $FilePath = "index.html" }
            $FullFilePath = [System.IO.Path]::Combine($RootPath, $FilePath.Replace('/', '\'))

            if (Test-Path $FullFilePath -PathType Leaf) {
                $Bytes = [System.IO.File]::ReadAllBytes($FullFilePath)
                $MimeType = Get-MimeType $FullFilePath

                $Header = "HTTP/1.1 200 OK`r`n" +
                          "Content-Type: $MimeType`r`n" +
                          "Content-Length: $($Bytes.Length)`r`n" +
                          "Access-Control-Allow-Origin: *`r`n" +
                          "Connection: close`r`n`r`n"
                $HeaderBytes = [System.Text.Encoding]::UTF8.GetBytes($Header)
                $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
                $Stream.Write($Bytes, 0, $Bytes.Length)
            } else {
                $NotFound = "<html><body><h1>404 Not Found</h1></body></html>"
                $NotFoundBytes = [System.Text.Encoding]::UTF8.GetBytes($NotFound)
                $Header = "HTTP/1.1 404 Not Found`r`n" +
                          "Content-Type: text/html; charset=utf-8`r`n" +
                          "Content-Length: $($NotFoundBytes.Length)`r`n" +
                          "Access-Control-Allow-Origin: *`r`n" +
                          "Connection: close`r`n`r`n"
                $HeaderBytes = [System.Text.Encoding]::UTF8.GetBytes($Header)
                $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
                $Stream.Write($NotFoundBytes, 0, $NotFoundBytes.Length)
            }

            $Writer.Flush()
            $Client.Close()
        } catch {
            if ($Client) {
                try { $Client.Close() } catch {}
            }
        }
    }
}
finally {
    if ($Listener) { $Listener.Stop() }
}