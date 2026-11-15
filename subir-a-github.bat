@echo off
cd /d "%~dp0"
echo Subiendo TerraPulse a GitHub...
git add -A
git commit -m "Terra: voz natural, interrupciones, busqueda de lugares y reportes con interpretacion"
git push origin main
echo.
echo Si arriba no aparece ningun error, la pagina se actualiza sola en unos 2 minutos:
echo https://eduardo24-max.github.io/TerraPulse/
pause
