"""Checagem da lógica das fotos: python -m crawler.test_fotos (não acessa a rede)."""
import tempfile
import zipfile
from pathlib import Path

from .fotos import anos_disponiveis, conferir, nome_da_foto, unidades


def main() -> None:
    assert anos_disponiveis(2024)[0] == 2004 and anos_disponiveis(2024)[-1] == 2024
    assert anos_disponiveis(2024, [2002, 2022]) == [2022]
    # BR (Presidente) e DF só existem nas eleições gerais
    assert unidades(2022, ["DF", "PI", "BR"]) == ["DF", "PI", "BR"]
    assert unidades(2024, ["DF", "PI", "BR"]) == ["PI"]

    # os três formatos de nome do TSE: com F (2006-08, 2016+), sem F (2010-14) e município_SQ (2004)
    nomes = ["FPI180001605662_div.jpg", "FPI18000160566_div.png", "PI180000000028_div.jpg",
             "FPI10537_00073_div.png", "leiame.pdf"]
    assert nome_da_foto(nomes, 180001605662) == "FPI180001605662_div.jpg"
    assert nome_da_foto(nomes, 18000160566) == "FPI18000160566_div.png"   # prefixo não confunde SQs
    assert nome_da_foto(nomes, 180000000028) == "PI180000000028_div.jpg"
    assert nome_da_foto(nomes, 73, municipio=10537) == "FPI10537_00073_div.png"
    assert nome_da_foto(nomes, 73) is None and nome_da_foto(nomes, 1) is None

    with tempfile.TemporaryDirectory() as pasta:
        z = Path(pasta) / "foto_cand2022_PI_div.zip"
        with zipfile.ZipFile(z, "w") as saida:
            saida.writestr("FPI1_div.jpg", b"\xff\xd8jpg")
            saida.writestr("FPI2_div.png", b"\x89PNG")
            saida.writestr("leiame.pdf", b"%PDF")
        r = conferir(z)
        assert r == {"fotos": 2, "formatos": {"jpg": 1, "png": 1}, "bytes_fotos": 9}, r
    print("ok")


if __name__ == "__main__":
    main()
