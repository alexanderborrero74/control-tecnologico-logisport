@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
echo El archivo Excel debe copiarse manualmente a:
echo.
echo   public\data\SERVICIOS_POR_CLIENTE.xlsx
echo.
echo Cuando lo copies ahi, la app lo leera automaticamente con el boton Cargar Base.
echo.
echo Para actualizar tarifas en el futuro:
echo   1. Edita el Excel con los nuevos valores
echo   2. Reemplaza el archivo en public\data\SERVICIOS_POR_CLIENTE.xlsx
echo   3. Ejecuta: vercel --prod
echo   4. En la app presiona: Cargar Base (3 clientes)
pause
