# Altyazi Studio - Super Otomatik Kurulum ve Baslatma Scripti
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $PSScriptRoot

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   ALTYAZI STUDIO - TAM OTOMATIK KURULUM" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Yönetici izni kontrolü (Bazı kurulumlar için gerekebilir)
function Check-Admin {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host "--- [1/4] Eksik Sistem Bilesenleri Kontrol Ediliyor ---" -ForegroundColor Yellow

# 1. Python Kontrol ve Kurulum
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Python bulunamadi. Winget ile otomatik kuruluyor..." -ForegroundColor Magenta
    winget install --id Python.Python.3.11 --exact --silent --accept-source-agreements --accept-package-agreements
    Write-Host "[+] Python kuruldu. Lutfen bu pencereyi kapatip start.bat'i tekrar acin (PATH guncellemesi icin)." -ForegroundColor Green
    Pause
    exit
}

# 2. Node.js Kontrol ve Kurulum
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Node.js bulunamadi. Winget ile otomatik kuruluyor..." -ForegroundColor Magenta
    winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
    Write-Host "[+] Node.js kuruldu. Lutfen bu pencereyi kapatip start.bat'i tekrar acin (PATH guncellemesi icin)." -ForegroundColor Green
    Pause
    exit
}

# 3. FFmpeg Kontrol ve Kurulum (Video isleme icin sart)
if (!(Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "[!] FFmpeg bulunamadi. Winget ile otomatik kuruluyor..." -ForegroundColor Magenta
    winget install --id Gyan.FFmpeg --silent --accept-source-agreements --accept-package-agreements
    Write-Host "[+] FFmpeg kuruldu." -ForegroundColor Green
}

Write-Host "--- [2/4] Python Sanal Ortam ve Kutuphaneler ---" -ForegroundColor Yellow

# Backend Hazirlik
if (!(Test-Path "backend\venv")) {
    Write-Host "> Virtual Environment olusturuluyor..."
    python -m venv backend\venv
}

Write-Host "> Python paketleri kontrol ediliyor..."
& "backend\venv\Scripts\python.exe" -m pip install --upgrade pip
& "backend\venv\Scripts\python.exe" -m pip install -r backend\requirements.txt

Write-Host "--- [3/4] Arayuz (Frontend) Paketleri ---" -ForegroundColor Yellow

# Frontend Hazirlik
Set-Location frontend
if (!(Test-Path "node_modules")) {
    Write-Host "> Node paketleri yukleniyor (Ilk kurulum biraz zaman alabilir)..."
    npm install
}
Set-Location ..

Write-Host "--- [4/4] Uygulama Baslatiliyor ---" -ForegroundColor Green

# Uygulamayi iki ayri pencerede baslat
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "UYGULAMA HAZIR!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend API: http://localhost:8000"
Write-Host "===============================================" -ForegroundColor Cyan
