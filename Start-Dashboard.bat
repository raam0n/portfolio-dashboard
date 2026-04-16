@echo off
title Portfolio Dashboard Server
echo =======================================================
echo    Iniciando el motor criptografico del Dashboard...
echo =======================================================
echo.
echo 1. Abrir la URL en tu PC: http://localhost:5173/
echo 2. Busca la URL "Network" abajo para usar en tu celular.
echo.
echo NOTA: Podes minimizar esta ventana negra, pero NO la cierres.
echo Si la cerras, el motor se apagara y el dashboard dejara de funcionar.
echo.
call npm run dev -- --host
pause

