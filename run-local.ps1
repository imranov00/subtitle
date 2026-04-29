# Altyazi Studio - Otomatik Kurulum ve Baslatma Scripti
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $PSScriptRoot

Write-Host "--- [1/3] Sistem Kontrolleri Yapiliyor ---" -ForegroundColor Cyan

# 1. Python Kontrolü
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "HATA: Python yuklu degil! Lutfen Python yukleyin (python.org)" -ForegroundColor Red
    Pause
    exit
}

# 2. Node.js Kontrolü
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "HATA: Node.js/npm yuklu degil! Lutfen Node.js yukleyin (nodejs.org)" -ForegroundColor Red
    Pause
    exit
}

Write-Host "--- [2/3] Bagimliliklar Kontrol Ediliyor/Yukleniyor ---" -ForegroundColor Cyan

# Backend Hazirlik
Write-Host "> Backend ayarlaniyor..." -ForegroundColor Yellow
if (!(Test-Path "backend\venv")) {
    Write-Host "  Virtual Environment olusturuluyor..."
    python -m venv backend\venv
}

# Paketleri yukle
& "backend\venv\Scripts\python.exe" -m pip install --upgrade pip
& "backend\venv\Scripts\python.exe" -m pip install -r backend\requirements.txt

# Frontend Hazirlik
Write-Host "> Frontend ayarlaniyor..." -ForegroundColor Yellow
Set-Location frontend
if (!(Test-Path "node_modules")) {
    Write-Host "  Node paketleri yukleniyor (bu biraz zaman alabilir)..."
    npm install
}
Set-Location ..

Write-Host "--- [3/3] Uygulama Baslatiliyor ---" -ForegroundColor Green

# Ekranlari temizle ve baslat
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "Uygulama aciliyor!" -ForegroundColor Green
Write-Host "Backend: http://localhost:8000"
Write-Host "Frontend: http://localhost:5173"
