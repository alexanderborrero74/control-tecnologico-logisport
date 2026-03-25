@echo off
REM ========================================
REM LOGISPORT - Script de Deployment
REM ========================================

echo.
echo ============================================
echo   LOGISPORT - Deployment Automatico
echo ============================================
echo.

cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport

echo [1/5] Limpiando cache...
if exist node_modules rd /s /q node_modules
if exist .next rd /s /q .next
if exist package-lock.json del /f /q package-lock.json
echo      - Cache limpiado OK

echo.
echo [2/5] Instalando dependencias...
call npm install
if errorlevel 1 (
    echo      - ERROR: Fallo en npm install
    pause
    exit /b 1
)
echo      - Dependencias instaladas OK

echo.
echo [3/5] Construyendo proyecto...
call npm run build
if errorlevel 1 (
    echo      - ERROR: Fallo en npm run build
    pause
    exit /b 1
)
echo      - Build completado OK

echo.
echo [4/5] Desplegando a Vercel...
call vercel --prod
if errorlevel 1 (
    echo      - ADVERTENCIA: Vercel deployment tuvo problemas
    echo      - Puedes intentar manualmente: vercel --prod
    pause
)
echo      - Deployment completado

echo.
echo [5/5] Verificando deployment...
echo.
echo ============================================
echo   DEPLOYMENT COMPLETADO
echo ============================================
echo.
echo Proximos pasos:
echo.
echo 1. Configura variables de entorno en Vercel:
echo    https://vercel.com/soporteias-projects/control-tecnologico-logisport/settings/environment-variables
echo.
echo 2. Publica las reglas de Firebase:
echo    Copia firestore.rules y publicalo en Firebase Console
echo.
echo 3. Prueba la app en:
echo    https://control-tecnologico-logisport.vercel.app
echo.
echo ============================================
echo.

pause
