@echo off
TITLE Altyazi Studio - Launcher
echo ===========================================
echo   Altyazi Studio Baslatiliyor...
echo ===========================================
echo.
powershell -ExecutionPolicy Bypass -File ".\run-local.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Bir hata olustu. Lutfen yukaridaki mesajlari kontrol edin.
    pause
)
