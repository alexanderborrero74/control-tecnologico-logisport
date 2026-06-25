@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node fix_dup_todos.js
node fix_excel_dinamico.js
echo.
echo IMPORTANTE: Copia el archivo Excel a:
echo   public\data\SERVICIOS_POR_CLIENTE.xlsx
echo.
pause
echo Desplegando...
vercel --prod
pause
