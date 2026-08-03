import time
import requests

start = time.time()
res = requests.post("http://localhost:8000/auth/login", data={"username": "admin@dilegno.com.br", "password": "admin"})
token = res.json().get("access_token")
if not token:
    print("Login failed:", res.text)
    token = requests.post("http://localhost:8000/auth/login", data={"username": "admin@dilegno.com.br", "password": "123456"}).json().get("access_token")

headers = {"Authorization": f"Bearer {token}"}

t1 = time.time()
r1 = requests.get("http://localhost:8000/clientes/", headers=headers)
print("Clientes:", time.time() - t1, len(r1.content))

t2 = time.time()
r2 = requests.get("http://localhost:8000/estoque/produtos?is_catalogo=false", headers=headers)
print("Estoque:", time.time() - t2, len(r2.content))

t3 = time.time()
r3 = requests.get("http://localhost:8000/estoque/produtos?is_catalogo=true", headers=headers)
print("Catalogo:", time.time() - t3, len(r3.content))

t4 = time.time()
r4 = requests.get("http://localhost:8000/fornecedores/", headers=headers)
print("Fornecedores:", time.time() - t4, len(r4.content))

t5 = time.time()
r5 = requests.get("http://localhost:8000/usuarios/", headers=headers)
print("Usuarios:", time.time() - t5, len(r5.content))

