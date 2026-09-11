@echo off
setlocal
cd /d "%~dp0"
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSDIR=%%i"
if not defined VSDIR exit /b 1
call "%VSDIR%\VC\Auxiliary\Build\vcvars64.bat" >nul
if not exist build mkdir build
cl /nologo /std:c++17 /EHsc /W4 /O2 /MT /DUNICODE /D_UNICODE ui_tests.cpp /Fo:build\ui_tests.obj /Fe:build\ui_tests.exe /link gdiplus.lib user32.lib gdi32.lib
if errorlevel 1 exit /b 1
build\ui_tests.exe
exit /b %errorlevel%
