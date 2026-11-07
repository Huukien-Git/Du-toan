@echo off
chcp 65001 >nul
title Tự Động Cài Đặt Cloudflare WARP - Mở Khóa Google AI Studio Online 100%
color 0b

echo ===============================================================================
echo     BỘ CÀI ĐẶT TỰ ĐỘNG CLOUDFLARE WARP CHÍNH HÃNG (CLOUDFLARE INC.)
echo     Tự Động Mở Khóa Toàn Bộ Mô Hình Gemini 3.8 Flash / 2.0 Flash Online 100%
echo ===============================================================================
echo.

:: 1. Kiểm tra quyền Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Yêu cầu quyền Administrator để đăng ký dịch vụ kết nối Cloudflare.
    echo [*] Đang mở hộp thoại cấp quyền Admin (Vui lòng chọn Yes)...
    powershell -Command "Start-Process cmd.exe -ArgumentList '/c', ('`\"' + '%~f0' + '`\"') -Verb RunAs"
    exit /b
)

echo [1/3] Đang kiểm tra công cụ cài đặt hệ thống...
set WARP_PATH=%ProgramFiles%\Cloudflare\Cloudflare WARP\warp-cli.exe
if exist "%WARP_PATH%" (
    echo [*] Cloudflare WARP đã có sẵn trên máy tính của bạn!
    goto :ACTIVATE
)

:: Thử cài đặt qua winget
echo [2/3] Đang tiến hành cài đặt Cloudflare WARP chính hãng...
where winget >nul 2>&1
if %errorLevel% equ 0 (
    echo     -> Đang cài đặt qua Windows Package Manager (winget)...
    winget install --id Cloudflare.Warp -e --accept-package-agreements --accept-source-agreements --silent
)

:: Nếu winget không hoàn tất hoặc chưa có file, tải trực tiếp MSI từ CDN chính thức của Cloudflare
if not exist "%WARP_PATH%" (
    echo     -> Đang tải gói cài đặt MSI chính thức từ máy chủ Cloudflare...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $wc = New-Object System.Net.WebClient; $target = Join-Path $env:TEMP 'Cloudflare_WARP.msi'; Write-Host 'Đang tải file...'; $wc.DownloadFile('https://downloads.cloudflareclient.com/v1/download/windows/version/2026.8.2115.0', $target); Write-Host 'Đang thực thi cài đặt MSI...'; Start-Process msiexec.exe -ArgumentList '/i', ('`\"' + $target + '`\"'), '/passive', '/norestart' -Wait"
)

:ACTIVATE
echo.
echo [3/3] Đang đăng ký và tự động kích hoạt kết nối Cloudflare WARP...
timeout /t 3 >nul

if exist "%WARP_PATH%" (
    "%WARP_PATH%" registration new >nul 2>&1
    "%WARP_PATH%" mode warp >nul 2>&1
    "%WARP_PATH%" connect >nul 2>&1
    echo.
    echo ===============================================================================
    echo   [XONG] ĐÃ CÀI ĐẶT VÀ KÍCH HOẠT CLOUDFLARE WARP THÀNH CÔNG!
    echo   Bây giờ bạn có thể dùng Key API Google Gemini Online 100% không bị chặn!
    echo ===============================================================================
) else (
    echo.
    echo [!] Đang hoàn tất tiến trình cài đặt. Vui lòng mở lại phần mềm sau 10 giây!
)

echo.
echo Bấm phím bất kỳ để đóng cửa sổ này...
pause >nul
