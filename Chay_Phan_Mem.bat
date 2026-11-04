@echo off
chcp 65001 >nul
title Khởi Động Phần Mềm Áp Giá Tự Động Cơ Điện (MEP Auto-Pricing)

set "APP_DIR=%~dp0"
set "APP_FILE=%APP_DIR%index.html"

:: 1. Kiểm tra Google Chrome (64-bit, 32-bit, LocalAppData)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="%APP_FILE%" --window-size=1440,900
    exit
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app="%APP_FILE%" --window-size=1440,900
    exit
)
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" --app="%APP_FILE%" --window-size=1440,900
    exit
)

:: 2. Kiểm tra Microsoft Edge (64-bit, 32-bit, LocalAppData)
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="%APP_FILE%" --window-size=1440,900
    exit
)
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app="%APP_FILE%" --window-size=1440,900
    exit
)
if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" --app="%APP_FILE%" --window-size=1440,900
    exit
)

:: 3. Mở bằng trình duyệt mặc định nếu không tìm thấy Chrome/Edge đường dẫn trên
start "" "%APP_FILE%"
exit
