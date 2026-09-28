@echo off
title Vimas Quest - Serveur local
cd /d "%~dp0"
echo ============================================
echo   VIMAS QUEST - Serveur de test local
echo   Adresse : http://localhost:8767/index.html
echo   (Laissez cette fenetre ouverte pendant les tests.)
echo ============================================
start http://localhost:8767/index.html
python -m http.server 8767
