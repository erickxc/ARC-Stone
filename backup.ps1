docker exec -t dilegno_db pg_dump -U postgres -d dilegno > backup.sql
echo "Backup gerado com sucesso em backup.sql"
