Get-Content backup.sql | docker exec -i dilegno_db psql -U postgres -d dilegno
echo "Banco de dados restaurado com sucesso a partir de backup.sql"
