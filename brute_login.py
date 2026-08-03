import requests
import time

url = "http://localhost:8000/auth/login"
email = "admin@dilegno.com.br"
senhas = ["123456", "password", "errada0", "errada1", "errada2", "errada3", "errada4", "Admin@123!"] * 20

print(f"Iniciando teste de brute force em {url}")

for i, senha in enumerate(senhas):
    resp = requests.post(url, data={"username": email, "password": senha})
    print(f"Tentativa {i+1}: {resp.status_code} - {resp.text}")
    if resp.status_code == 200:
        print("Sucesso! Token:", resp.json().get("access_token"))
        break
    time.sleep(0.1)
