Write-Host "Iniciando Banco de Dados no Docker..." -ForegroundColor Cyan
docker compose up -d db

Write-Host "Iniciando Backend (API)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; if (-not (Test-Path venv)) { Write-Host 'Criando venv...'; python -m venv venv }; .\venv\Scripts\Activate.ps1; pip install -r requirements.txt; uvicorn main:app --reload --env-file ../.env"

Write-Host "Iniciando Frontend (Vite)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm install; npm run dev"

Write-Host "Ambiente local iniciado! O backend e o frontend abriram em novas janelas." -ForegroundColor Green
