@echo off
TITLE Altyazi Studio - Hepsi Bir Arada Baslatici
SETLOCAL EnableDelayedExpansion

echo ===============================================================
echo            ALTYAZI STUDIO - OTOMATIK SISTEM
echo ===============================================================
echo.

:: 1. Python Kontrol ve Kurulum
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Python bulunamadi. Kuruluyor...
    winget install --id Python.Python.3.11 --exact --silent --accept-source-agreements --accept-package-agreements
    echo [+] Python kuruldu. Lutfen bu pencereyi kapatin ve tekrar acin.
    pause
    exit
)

:: 2. Node.js Kontrol ve Kurulum
npm -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js bulunamadi. Kuruluyor...
    winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
    echo [+] Node.js kuruldu. Lutfen bu pencereyi kapatin ve tekrar acin.
    pause
    exit
)

:: 3. FFmpeg Kontrol
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] FFmpeg bulunamadi. Kuruluyor...
    winget install --id Gyan.FFmpeg --silent --accept-source-agreements --accept-package-agreements
)

:: 4. Backend Hazirlik
echo --- Backend Hazirlaniyor ---
if not exist "backend\venv" (
    echo [>] Sanal ortam olusturuluyor...
    python -m venv backend\venv
)
echo [>] Python kutuphaneleri kontrol ediliyor...
backend\venv\Scripts\python.exe -m pip install -q --upgrade pip
backend\venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt

:: 5. Frontend Hazirlik
echo --- Frontend Hazirlaniyor ---
cd frontend
if not exist "node_modules" (
    echo [>] Node paketleri yukleniyor (Ilk sefer icin uzun surebilir)...
    call npm install --silent
)
cd ..

:: 6. Baslatma
echo.
echo ===============================================================
echo        HER SEY HAZIR! UYGULAMA BASLATILIYOR...
echo ===============================================================
echo.

:: Backend'i arka planda başlat
start /min "Altyazi_Backend" cmd /c "cd backend && venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"

:: Frontend'i başlat (bu pencereyi açık tutar)
cd frontend
npm run dev

pause
