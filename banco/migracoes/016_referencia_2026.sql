-- Eleição de 2026 no viés. Como 2024, usa a onda de 2022 do artigo (a última publicada), estendida agora
-- por quatro anos; a janela do SVD é a 57ª legislatura até a véspera do 1º turno (4/10/2026).
-- Depois de aplicar: python scripts/svd_camara.py --nome eleicao_2026 ... e python -m loader.vies
INSERT INTO eleicao_referencia VALUES
    (2026, '2026-10-04', 2022, true, 'eleicao_2026', '2023-02-01', '2026-10-03', '{1,3,5,6,7,8}',
     '57ª legislatura; presidente, governador, senador, deputados federal, estadual e distrital; onda 2022 estendida por quatro anos');
