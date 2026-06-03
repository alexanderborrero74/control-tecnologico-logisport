@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
findstr /n "Guardar\|guardar\|setCuadrill\|cuadrillaDia\|serviciosExtra\|serviciosMulti\|sMulti\|Agregar otro" pages\nomina\matriz.js > busqueda_c2.txt
echo LISTO - lineas encontradas:
find /c "" busqueda_c2.txt
type busqueda_c2.txt
pause
