@echo off
chcp 65001 >nul
title Khởi Động Phần Mềm Áp Giá Tự Động Cơ Điện (MEP Auto-Pricing)

cd /d "%~dp0"
set "APP_DIR=%~dp0"
set "APP_URL=http://localhost:3000"
set "FALLBACK_FILE=%APP_DIR%index.html"

:: 1. Kiểm tra và khởi động Máy Chủ Cục Bộ (Local Gateway Server) nếu có Node.js
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [1/2] Đang khởi động Máy Chủ Cục Bộ & Cổng Chuyển Tiếp Google AI...
    taskkill /F /IM node.exe /FI "WINDOWTITLE eq MEP-Server*" >nul 2>nul
    start "MEP-Server" /min node server.js
    timeout /t 1 /nobreak >nul
    set "TARGET_URL=%APP_URL%"
) else (
    echo [Cảnh báo] Không tìm thấy Node.js trên máy tính. Sẽ mở trực tiếp tệp giao diện.
    set "TARGET_URL=%FALLBACK_FILE%"
)

echo [2/2] Đang mở giao diện phần mềm...

:: 2. Khởi động với Google Chrome (64-bit, 32-bit, LocalAppData)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="%TARGET_URL%" --window-size=1440,900
    exit
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app="%TARGET_URL%" --window-size=1440,900
    exit
)
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" --app="%TARGET_URL%" --window-size=1440,900
    exit
)

:: 3. Khởi động với Microsoft Edge (64-bit, 32-bit, LocalAppData)
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="%TARGET_URL%" --window-size=1440,900
    exit
)
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app="%TARGET_URL%" --window-size=1440,900
    exit
)
if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" --app="%TARGET_URL%" --window-size=1440,900
    exit
)

:: 4. Mở bằng trình duyệt mặc định nếu không tìm thấy Chrome/Edge đường dẫn trên
start "" "%TARGET_URL%"
exit
