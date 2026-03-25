@echo off
cls
echo =============================================================================
echo MIGRACION MASIVA DE PAGINAS - LOGISPORT
echo =============================================================================
echo.
echo Este script migrara TODAS las paginas pendientes al nuevo layout con sidebar
echo.
echo Paginas a migrar:
echo   - servicios-tecnicos.js
echo   - estadisticas.js
echo   - indicadores-gestion.js
echo   - licencias.js
echo   - control-de-contrasenas.js
echo   - nube.js
echo   - trazabilidad-logins.js
echo   - registro-fotografico.js
echo   - procesoit.js
echo   - serviciospendientes.js
echo   - historial-credenciales.js
echo   - usuario-aplicaciones-licencias.js
echo.
echo =============================================================================
echo.
pause

echo.
echo Ejecutando script de migracion...
echo.

python MIGRAR_TODAS_LAS_PAGINAS.py

echo.
echo =============================================================================
echo SCRIPT COMPLETADO
echo =============================================================================
echo.
echo SIGUIENTE PASO:
echo    1. Revisar los cambios con: git diff
echo    2. Probar localmente con: npm run dev
echo    3. Desplegar con: vercel --prod
echo.
pause
