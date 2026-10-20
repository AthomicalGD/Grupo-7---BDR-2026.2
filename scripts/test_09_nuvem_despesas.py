"""Verifica o recorte, a classificação e a soma da nuvem sem depender do banco.

Uso: python -m unittest discover -s scripts -p 'test_09*.py'
"""
import importlib.util
import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
spec = importlib.util.spec_from_file_location("nuvem_despesas", Path(__file__).with_name("09_nuvem_despesas.py"))
assert spec is not None and spec.loader is not None
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class NuvemDespesasTest(unittest.TestCase):
    def test_categoria_tse_prevalece_e_nao_confunde_excecao(self):
        self.assertEqual(mod.classificar("Publicidade por materiais impressos", "SERVIÇO DE TRANSPORTE"),
                         ("Propaganda impressa", False))
        self.assertEqual(mod.classificar("Locação/cessão de bens móveis (exceto veículos)", None),
                         ("Locação/cessão de bens móveis (exceto veículos)", False))

    def test_descricao_so_resolve_categorias_genericas(self):
        self.assertEqual(mod.classificar("Serviços prestados por terceiros", "SERVIÇO DE COORDENADOR DE CARREATAS E MOBILIZAÇÃO"),
                         ("Mobilização e militância", True))
        self.assertEqual(mod.classificar("Serviços prestados por terceiros", "SERV DE PRODUÇÃO,JORNALISMO E GESTÃO DE PLATAFORMA"),
                         ("Produção e gestão de conteúdo", True))
        self.assertEqual(mod.classificar("Diversas a especificar", "SERVIÇO DE FISCAL DIA ELEIÇÃO"),
                         ("Fiscalização da eleição", True))
        self.assertEqual(mod.classificar("Serviços prestados por terceiros", "EMISSÃO DE NOTA FISCAL"),
                         ("Outros serviços (não identificados)", False))
        self.assertEqual(mod.classificar("Diversas a especificar", None), ("Não especificado", False))

    def test_soma_e_fornecedor_ausente_sem_adivinhar_atividade(self):
        grupos, zeradas, sem_fornecedor = mod.calcular([
            ("Publicidade por adesivos", "ADITIVO", Decimal("10.10"), 7, "Empresa A"),
            ("Publicidade por materiais impressos", "ADESIVOS", Decimal("20.90"), 7, "Empresa A"),
            ("Serviços prestados por terceiros", "TRANSPORTE", Decimal("8.00"), None, None),
            ("Serviços prestados por terceiros", "SERVIÇO NÃO IDENTIFICADO", Decimal("2.00"), 8, "Empresa A"),
            (None, None, Decimal("0.00"), None, None),
        ])
        self.assertEqual((zeradas, sem_fornecedor), (1, 1))
        self.assertEqual(grupos["Propaganda impressa"]["valor"], Decimal("31.00"))
        self.assertEqual(grupos["Propaganda impressa"]["fornecedores"][(7, "Empresa A")], [Decimal("31.00"), 2])
        self.assertEqual(grupos["Transporte e veículos"]["inferidas"], 1)
        self.assertEqual(grupos["Outros serviços (não identificados)"]["valor"], Decimal("2.00"))


if __name__ == "__main__":
    unittest.main()
