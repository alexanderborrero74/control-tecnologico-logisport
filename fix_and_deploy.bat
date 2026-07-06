@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node fix_import_snap.js
echo.
echo Desplegando reglas Firestore...
firebase deploy --only firestore:rules
echo.
echo Desplegando app...
vercel --prod
pause
