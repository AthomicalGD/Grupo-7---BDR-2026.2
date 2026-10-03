import httpx

r = httpx.get(
    "https://apisidra.ibge.gov.br/values/t/6579/n6/all/v/9324/p/2017",
    headers={"User-Agent": "Mozilla/5.0"},
)

print(r.status_code)
print(r.text[:500])