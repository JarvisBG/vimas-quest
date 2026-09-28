@echo off
title DOMAF Quest - Serveur local
cd /d "%~dp0"
echo ============================================
echo   DOMAF QUEST - Serveur de test local
echo   Adresse : http://localhost:8766/index.html
echo   (Laissez cette fenetre ouverte pendant les tests.)
echo ============================================
start http://localhost:8766/index.html
python -m http.server 8766
