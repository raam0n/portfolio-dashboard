@echo off
echo Iniciando proceso ETL de Market Insights...
cd /d "%~dp0"
node scripts/etl_youtube_insights.js
echo Proceso finalizado.
pause
