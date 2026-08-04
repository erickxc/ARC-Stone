# Le POSTGRES_USER/POSTGRES_DB do .env (mesmas variaveis usadas pelo docker-compose) em vez
# de fixar valores — evita repetir o erro de nomes desatualizados (container/banco antigos
# "dilegno_db"/"dilegno" nao existem mais desde o rebranding para ARC).
$envFile = Join-Path $PSScriptRoot ".env"
$pgUser = "arc_user"
$pgDb = "arc_erp"
if (Test-Path $envFile) {
    $envMap = @{}
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*)\s*$') { $envMap[$Matches[1]] = $Matches[2] }
    }
    if ($envMap.ContainsKey('POSTGRES_USER')) { $pgUser = $envMap['POSTGRES_USER'] }
    if ($envMap.ContainsKey('POSTGRES_DB')) { $pgDb = $envMap['POSTGRES_DB'] }
}

docker exec -t arc_db pg_dump -U $pgUser -d $pgDb > backup.sql
Write-Host "Backup gerado com sucesso em backup.sql" -ForegroundColor Green
