# Le POSTGRES_USER/POSTGRES_DB do .env, igual ao backup.ps1 — mesmo motivo (nomes antigos
# "dilegno_db"/"dilegno" nao existem mais).
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

Get-Content backup.sql | docker exec -i arc_db psql -U $pgUser -d $pgDb
Write-Host "Banco de dados restaurado com sucesso a partir de backup.sql" -ForegroundColor Green
