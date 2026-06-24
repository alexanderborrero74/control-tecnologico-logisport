@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
npm install firebase-admin --save-dev > nul 2>&1
node seed_servicios_admin.js > servicios_admin_log.txt 2>&1
type servicios_admin_log.txt
pause
