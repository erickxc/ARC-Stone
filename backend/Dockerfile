FROM python:3.11-slim

WORKDIR /app

# Instalar dependências de sistema necessárias para o PostgreSQL (psycopg2)
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Produção segura por padrão; desenvolvimento ativa --reload no compose local.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
