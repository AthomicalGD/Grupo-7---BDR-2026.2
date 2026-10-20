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
    def test_nome_dos_arquivos_identifica_pessoa_e_eleicao(self):
        base = (744696, 180000614002, "JOSÉ WELLINGTON BARROSO DE ARAÚJO DIAS", 2018, 2, "GOVERNADOR", "PI")
        self.assertEqual(mod.nome_arquivo(base), "2018_jose_wellington_barroso_de_araujo_dias_744696")
        self.assertEqual(mod.nome_arquivo((756622, 1, "SÍLVIO MENDES DE OLIVEIRA FILHO", 2024, 2, "PREFEITO", "Teresina")),
                         "2024_silvio_mendes_de_oliveira_filho_756622")

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

    def test_variantes_reais_de_quatro_eleicoes(self):
        exemplos = [
            ("SERVICO DE PANFLETEIRO", "Mobilização e militância"),
            ("SERVICO DE PANFELTEIRO", "Mobilização e militância"),
            ("CABO ELEITORAL", "Mobilização e militância"),
            ("SERVIÇOS DE CABO ELEITORAL", "Mobilização e militância"),
            ("ASSESSORIA DE MIDIAS SOCIAIS CONF CONTRATOI", "Comunicação digital"),
            ("GERENCIAMENTO DE MIDIAS SOCIAIS E MK DIGITAL", "Comunicação digital"),
            ("SERV. DE COMUNIC DIG GESTAO DE REDES E CURADORIA", "Comunicação digital"),
            ("SERVICOS ADVOCATICIOS PRESTACAO DE CONTAS", "Serviços advocatícios"),
            ("SERVICOS CONTABEIS", "Serviços contábeis"),
            ("SERVICO DE VIGILANCIA ARMADA", "Segurança"),
            ("SERVICO CLIPPING MONITORAMENTO NOTICIARIO", "Comunicação e assessoria"),
            ("COORDENADOR DE CAMPANHA", "Coordenação de campanha"),
            ("SERVICO DE ALMOXARIFE", "Administração e apoio"),
            ("ESTRATEGIA E UTILIZACAO PLATAFORMA WEBMOBIL FOLLOW", "Comunicação digital"),
            ("SERVICO DE EDICAO DE VIDEOS", "Propaganda audiovisual"),
            ("NF 02 CRIAÇÃO DE PLANEJAMENTO DE CAMPANHAS", "Planejamento de campanha"),
            ("SERVIÇO ADMINISTRATIVO", "Administração e apoio"),
            ("INSTALACAO, ORGANIZACAO, OPERACOES DO COMITE", "Estrutura e manutenção"),
            ("GIRANDOLA 468 TIROS", "Fogos de artifício"),
            ("FILMAGENS CINEMATOGRÁFICAS CAMPANHA ELEITORAL", "Propaganda audiovisual"),
            ("SERVIÇOS DE GESTÃO TRAFEGO PAGO E OTIMIZAÇÃO DE CA", "Propaganda digital"),
            ("PRESTAÇÃO DE VIGIA NOTURNO 16X36 27 DIAS", "Segurança"),
            ("SERVIÇOS DE INTERNET PARA O COMITÊ DE CAMPANHA", "Internet e telefonia"),
            ("PROD. AUDIOVISUAL· PLATAFORMAS DIGITAIS E OUTROS", "Propaganda audiovisual"),
            ("ESTRATÉGIA POLÍTICA· AGÊNCIA· CRIAÇÃO E OUTRAS", "Estratégia política"),
            ("ÁGUA MINERAL NATURAL 48/200ML REGINA", "Água"),
            ("PGTO INDENIZA SINISTRO VEICULAR PREVISTO EM CONTRA", "Indenização de veículo"),
            ("LONA IMPRESSA", "Propaganda impressa"),
        ]
        for descricao, rotulo in exemplos:
            with self.subTest(descricao=descricao):
                self.assertEqual(mod.classificar("Serviços prestados por terceiros", descricao), (rotulo, True))
        self.assertEqual(mod.classificar("Serviços prestados por terceiros", "CONTRATO DE PRESTAÇÃO DE SERVIÇOS"),
                         ("Outros serviços (não identificados)", False))
        self.assertEqual(mod.classificar("Serviços prestados por terceiros", "EMISSÃO DE NOTA FISCAL"),
                         ("Outros serviços (não identificados)", False))

    def test_soma_e_fornecedor_ausente_sem_adivinhar_atividade(self):
        grupos, zeradas, sem_fornecedor, cobertura = mod.calcular([
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
        self.assertEqual(cobertura["tipo TSE"], [2, Decimal("31.00")])
        self.assertEqual(cobertura["descrição"], [1, Decimal("8.00")])
        self.assertEqual(cobertura["sem identificação"], [1, Decimal("2.00")])
        self.assertIn("  sem identificação: 1 despesa, R$ 2,00 (4.9% do valor)",
                      mod.linhas_cobertura(cobertura))


if __name__ == "__main__":
    unittest.main()
