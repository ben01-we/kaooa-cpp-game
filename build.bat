@echo off
setlocal
cd /d "%~dp0"
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" goto missing
for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSDIR=%%i"
if not defined VSDIR goto missing
call "%VSDIR%\VC\Auxiliary\Build\vcvars64.bat" >nul
if not exist build mkdir build
cl /nologo /std:c++17 /EHsc /W4 /O2 /MT /DUNICODE /D_UNICODE main.cpp /Fo:build\main.obj /Fe:Kaooa.exe /link /SUBSYSTEM:WINDOWS gdiplus.lib user32.lib gdi32.lib
exit /b %errorlevel%
:missing
echo Install Visual Studio Build Tools with Desktop development with C++, then run build.bat again.
exit /b 1
