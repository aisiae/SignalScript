@echo off
title SignalScript Engine Setup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Engine.ps1"
if errorlevel 1 goto failed
echo.
echo Installation complete. Run Start-Engine.cmd next.
pause
exit /b 0

:failed
echo.
echo Installation failed. Keep this window open and send a screenshot to support.
pause
exit /b 1
