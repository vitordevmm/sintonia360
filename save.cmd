@echo off
echo ==========================================================
echo           SINTONIA 360 - BACKUP GITHUB
echo ==========================================================
echo.
echo [+] Salvando alteracoes localmente...
git add -A
git commit -m "Atualizacao automatica: %date% %time%"
echo.
echo [+] Enviando para o GitHub...
git push -u origin main
echo.
echo ==========================================================
echo                FIM DO PROCESSO DE BACKUP
echo ==========================================================
pause
