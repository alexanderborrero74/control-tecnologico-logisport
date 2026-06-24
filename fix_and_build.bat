@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
echo Moviendo constantes...
node fix_tdz.js > build_log.txt 2>&1
echo Ejecutando build...
npm run build >> build_log.txt 2>&1
echo.
echo === RESULTADO ===
type build_log.txt
echo.
echo Resultado guardado en build_log.txt
pause
