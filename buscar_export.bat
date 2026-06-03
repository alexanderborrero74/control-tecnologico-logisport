@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
findstr /n "exportarCSV\|exportarXLS\|Exportar CSV\|Exportar XLS\|detalle_" pages\nomina\matriz.js > export_lines.txt
type export_lines.txt
pause
