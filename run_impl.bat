@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
echo Ejecutando fase 1 (multi-servicio + editar SPIA)...
node impl_fase1.js
echo.
echo Ejecutando fase 2 (botón editar en tabla SPIA)...
node impl_fase2.js
echo.
echo Ejecutando fase 3 (cross-client workers)...
node impl_fase3.js
echo.
echo Todas las fases completadas.
pause
