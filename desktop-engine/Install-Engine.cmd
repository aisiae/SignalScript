@echo off
title SignalScript Engine 설치
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Engine.ps1"
if errorlevel 1 (
  echo.
  echo 설치가 완료되지 않았습니다. 위 안내를 확인해 주세요.
  pause
  exit /b 1
)
echo.
echo 설치가 완료되었습니다. 다음으로 Start-Engine.cmd를 실행해 주세요.
pause
