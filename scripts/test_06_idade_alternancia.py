"""Verifica faixas etárias, passagens de mandato (renomeação, fusão, troca), terços e efeitos sem depender do banco.

Uso: python -m unittest discover -s scripts -p 'test_06*.py'
"""
import importlib.util
import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
spec = importlib.util.spec_from_file_location("idade_alternancia", Path(__file__).with_name("06_idade_alternancia.py"))
assert spec is not None and spec.loader is not None
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class FaixasTest(unittest.TestCase):
    def test_ponto_medio_das_faixas_do_tse(self):
        self.assertEqual(mod.ponto_medio(1600), 16)
        self.assertEqual(mod.ponto_medio(2000), 20)
        self.assertEqual(mod.ponto_medio(2124), 22.5)
        self.assertEqual(mod.ponto_medio(9599), 97)
        self.assertEqual(mod.ponto_medio(9999), 100)

    def test_faixas_comuns_a_candidato_e_eleitor(self):
        self.assertEqual([mod.faixa_do_tse(c) for c in (1700, 1800, 3034, 3539, 4549, 5054, 6064, 6569, 9999)],
                         [0, 1, 1, 2, 2, 3, 3, 4, 4])


class PassagensTest(unittest.TestCase):
    lin = mod.Linhagens()

    def test_renomeacao_e_o_mesmo_partido(self):
        self.assertEqual(self.lin.passagem("PMDB", "MDB", 2016, 2020), mod.MESMO)
        self.assertEqual(self.lin.passagem("PFL", "DEM", 2004, 2008), mod.MESMO)
        self.assertEqual(self.lin.passagem("PR", "PL", 2016, 2020), mod.MESMO)

    def test_fusao_entre_as_eleicoes_e_troca_com_ressalva(self):
        self.assertEqual(self.lin.passagem("PSL", "UNIAO", 2020, 2024), mod.FUSAO)
        self.assertEqual(self.lin.passagem("DEM", "UNIAO", 2020, 2024), mod.FUSAO)
        self.assertEqual(self.lin.passagem("PTB", "PRD", 2020, 2024), mod.FUSAO)
        self.assertEqual(self.lin.passagem("PATRIOTA", "PRD", 2020, 2024), mod.FUSAO)
        self.assertEqual(self.lin.passagem("PSD41", "PTB", 2000, 2004), mod.FUSAO)

    def test_fusao_fora_do_intervalo_ou_no_sentido_inverso_e_troca(self):
        self.assertEqual(self.lin.passagem("DEM", "PSL", 2016, 2020), mod.TROCA)   # fundiram-se só em 2022
        self.assertEqual(self.lin.passagem("UNIAO", "PSL", 2020, 2024), mod.TROCA)
        self.assertEqual(self.lin.passagem("PT", "PSDB", 2020, 2024), mod.TROCA)

    def test_psd_antigo_e_atual_sao_partidos_diferentes(self):
        self.assertEqual(mod.chave_partido("PSD", 41), "PSD41")
        self.assertEqual(mod.chave_partido("PSD", 55), "PSD")
        self.assertEqual(self.lin.passagem("PSD", "PTB", 2016, 2020), mod.TROCA)

    def test_passagens_com_dois_eleitos_e_reeleicao_por_nome(self):
        pref = pd.DataFrame([
            (1, 2000, 10, "JOSÉ DA SILVA", "PFL", 25), (1, 2000, 11, "VICE", "PFL", 25),
            (1, 2004, 12, "Jose da Silva", "DEM", 25),          # mesma pessoa sem título ligado
            (1, 2008, 13, "OUTRA PESSOA", "PT", 13),
        ], columns=["cd_municipio", "ano", "id_politico", "nome", "sigla", "numero"])
        ref = pd.DataFrame({"cd_municipio": [1], "nm_municipio": ["X"], "sg_uf": ["PI"]})
        t = mod.passagens(pref, ref).set_index("ano")
        self.assertEqual(t.loc[2004, "passagem"], mod.MESMO)
        self.assertTrue(t.loc[2004, "mesma_pessoa"])
        self.assertEqual(t.loc[2008, "passagem"], mod.TROCA)
        self.assertFalse(t.loc[2008, "mesma_pessoa"])


class EstatisticaTest(unittest.TestCase):
    def test_tercos_respeitam_o_peso(self):
        df = pd.DataFrame({"idade": [30, 40, 50, 60], "peso": [1, 1, 6, 4]})
        self.assertEqual(list(mod.tercos(df, "idade", peso="peso")), [1, 1, 2, 3])
        self.assertEqual(list(mod.tercos(df, "idade")), [1, 2, 2, 3])

    def test_efeito_dentro_do_grupo_ignora_diferenca_entre_grupos(self):
        rng = np.random.default_rng(1)
        g = np.repeat([0, 1], 200)
        x = rng.normal(size=400) + 10 * g           # o grupo 1 tem x maior...
        y = 2 * x - 70 * g                          # ...e y menor: entre grupos a relação seria negativa
        e = mod.efeito(pd.DataFrame({"x": x, "y": y, "g": g}), "y", "x", "g", reps=50)
        self.assertAlmostEqual(e["b"], 2, places=6)

    def test_efeito_desconta_o_controle(self):
        rng = np.random.default_rng(2)
        z = rng.normal(size=500)
        x = z + 0.5 * rng.normal(size=500)
        y = -3 * z + 0.1 * rng.normal(size=500)     # y depende só de z; x só parece importar por causa de z
        d = pd.DataFrame({"x": x, "y": y, "z": z, "g": 0})
        self.assertLess(mod.efeito(d, "y", "x", "g", reps=10)["b"], -1)
        self.assertAlmostEqual(mod.efeito(d, "y", "x", "g", controles=("z",), reps=10)["b"], 0, delta=0.05)


if __name__ == "__main__":
    unittest.main()
