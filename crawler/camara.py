"""Votações nominais do Plenário da Câmara dos Deputados (Dados Abertos da Câmara).

Servem ao alinhamento dos partidos (scripts/svd_camara.py): um SVD sobre deputado x votação,
numa janela que termina antes de cada eleição. Três arquivos por ano, de 2015 (início da 55ª
legislatura, que cobre o governo Temer) até o ano corrente:
    votacoes-AAAA.csv               uma linha por votação (órgão, data, placar)
    votacoesVotos-AAAA.csv          o voto de cada deputado, com o partido na data
    votacoesOrientacoes-AAAA.csv    a orientação de cada bancada, inclusive a do Governo

Arquivos já em disco não são baixados de novo, exceto os do ano corrente, que a Câmara
ainda atualiza.
"""
from datetime import date
from pathlib import Path

from .rede import baixar

URL = "https://dadosabertos.camara.leg.br/arquivos/{tipo}/csv/{tipo}-{ano}.csv"
TIPOS = ("votacoes", "votacoesVotos", "votacoesOrientacoes")
PRIMEIRO_ANO = 2015


def coletar(cli, chave: str, raiz: Path) -> list[Path]:
    pasta = raiz / "camara"
    corrente = date.today().year
    baixados = []
    for ano in range(PRIMEIRO_ANO, corrente + 1):
        for tipo in TIPOS:
            destino = pasta / f"{tipo}-{ano}.csv"
            if destino.exists() and destino.stat().st_size and ano < corrente:
                print(f"    {destino.name}: já em disco", flush=True)
            else:
                baixar(cli, URL.format(tipo=tipo, ano=ano), destino, rotulo=destino.name)
                print(f"    {destino.name}: {destino.stat().st_size / 1e6:.1f} MB", flush=True)
            baixados.append(destino)
    return baixados
