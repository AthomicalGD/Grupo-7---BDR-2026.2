import { ArrowRight, CaretRight, Check, Copy } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
// as consultas mostradas aqui são os mesmos arquivos que o teste da API roda contra o banco
import p10Carreira from './consultas/p10_carreira.sql?raw'
import p10Reeleicao from './consultas/p10_reeleicao.sql?raw'
import p1Campanha from './consultas/p1_campanha.sql?raw'
import p1Gasto from './consultas/p1_gasto.sql?raw'
import p4Chance from './consultas/p4_chance.sql?raw'
import p4Lugar from './consultas/p4_lugar.sql?raw'
import p4Votos from './consultas/p4_votos.sql?raw'
import p7Vies from './consultas/p7_vies.sql?raw'
import p7VotosPartido from './consultas/p7_votos_partido.sql?raw'

/** Seção da metodologia; `resposta` leva à tela em que a questão é respondida. */
function Secao({ id, titulo, resposta, children }: {
  id: string
  titulo: string
  resposta?: { para: '/' | '/cadeira' | '/urna' | '/escola' | '/reeleicao'; rotulo: string }
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="grid scroll-mt-20 gap-4 border-t border-linha py-10 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-12">
      <div className="space-y-4">
        <h2 id={id} className="t-h2 scroll-mt-20">{titulo}</h2>
        {resposta && (
          <Link
            to={resposta.para}
            className="botao-vivo h-10 px-4 text-[0.88rem]"
          >
            {resposta.rotulo} <ArrowRight size={15} weight="bold" aria-hidden />
          </Link>
        )}
      </div>
      <div className="min-w-0 space-y-4 leading-relaxed text-tinta-2 [&>ol]:max-w-[72ch] [&>p]:max-w-[72ch] [&>ul]:max-w-[72ch] [&_b]:text-tinta [&_:not(pre)>code]:t-mono [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-papel-2 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-[0.9em] [&_:not(pre)>code]:text-tinta">
        {children}
      </div>
    </section>
  )
}

/** Bloco que abre e fecha (detalhes nativos): a página fica curta e o detalhe a um clique. */
function Detalhe({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className="group border-t border-linha first-of-type:mt-6">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded py-3 font-semibold text-tinta hover:text-acao focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao [&::-webkit-details-marker]:hidden">
        <CaretRight size={14} weight="bold" className="shrink-0 transition-transform duration-200 group-open:rotate-90" aria-hidden />
        {titulo}
      </summary>
      <div className="space-y-4 pb-6 pl-[22px]">{children}</div>
    </details>
  )
}

/** De onde vem cada dado: o que é, o arquivo baixado em dados/ e onde mora no banco. */
function Origens({ linhas }: { linhas: [ReactNode, ReactNode, ReactNode][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] table-fixed border-collapse text-left text-[0.86rem] [&_code]:[overflow-wrap:anywhere]">
        <thead>
          <tr className="border-b border-linha-2 text-[0.78rem] text-tinta-3">
            <th scope="col" className="w-[36%] py-2 pr-4 font-semibold">Dado</th>
            <th scope="col" className="w-[34%] py-2 pr-4 font-semibold">Arquivo baixado</th>
            <th scope="col" className="w-[30%] py-2 font-semibold">No banco</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(([dado, arquivo, banco], i) => (
            <tr key={i} className="border-b border-linha align-top">
              <td className="py-2 pr-4 text-tinta">{dado}</td>
              <td className="py-2 pr-4">{arquivo}</td>
              <td className="py-2">{banco}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Uma consulta SQL como está no repositório, com o botão de copiar. */
function Consulta({ titulo, sql }: { titulo: string; sql: string }) {
  const [copiada, setCopiada] = useState(false)
  const copiar = () =>
    navigator.clipboard?.writeText(sql.trim()).then(() => {
      setCopiada(true)
      setTimeout(() => setCopiada(false), 1600)
    })
  return (
    <figure className="overflow-hidden rounded-xl border border-linha bg-folha">
      <figcaption className="flex items-center justify-between gap-3 border-b border-linha px-4 py-2 text-[0.84rem] font-semibold text-tinta">
        {titulo}
        <button
          type="button"
          onClick={copiar}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[0.78rem] font-semibold text-acao hover:bg-papel focus-visible:outline-2 focus-visible:outline-acao"
        >
          {copiada ? <Check size={13} weight="bold" aria-hidden /> : <Copy size={13} aria-hidden />}
          {copiada ? 'Copiada' : 'Copiar'}
        </button>
      </figcaption>
      <pre className="overflow-x-auto px-4 py-3 text-[0.78rem] leading-[1.55] text-tinta">
        <code className="t-mono">{sql.trim()}</code>
      </pre>
    </figure>
  )
}

const ARQ = (caminho: string) => <code>{caminho}</code>

const INDICE = [
  ['m-caminho', 'Do arquivo ao banco'],
  ['m-cadeira', 'P1'],
  ['m-escolaridade', 'P4'],
  ['m-vies', 'P7'],
  ['m-carreira', 'P10'],
  ['m-reeleicao', 'P10a'],
  ['m-fontes', 'Fontes'],
  ['m-limites', 'Limitações'],
  ['m-reproduzir', 'Para reproduzir'],
] as const

export function Metodologia() {
  return (
    <article className="mx-auto max-w-[var(--casca-max)] px-4 pb-12 pt-7 md:px-[var(--casca-margem)]">
      <header className="pb-10">
        <h1 className="t-display">Como os números são feitos</h1>
        <p className="mt-4 max-w-[64ch] text-[1.05rem] leading-relaxed text-tinta-2">
          Tudo aqui sai de dados abertos baixados, modelados e carregados pelo grupo. Nada é estimado à mão: cada número
          pode ser refeito com os comandos do repositório. Em cada questão, abra os blocos para ver de onde vêm os dados,
          o que deu trabalho e as consultas SQL que fizemos.
        </p>
        <nav aria-label="Nesta página" className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[0.9rem]">
          {INDICE.map(([id, rotulo]) => (
            <a key={id} href={`#${id}`} className="font-semibold text-acao underline-offset-4 hover:underline">{rotulo}</a>
          ))}
        </nav>
      </header>

      <Secao id="m-caminho" titulo="Do arquivo ao banco">
        <p>Os dados percorrem cinco etapas, todas no repositório:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li><b>Coleta:</b> <code>python -m crawler</code> baixa do Portal de Dados Abertos do TSE, das APIs do IBGE (SIDRA, malhas e localidades), do Ipeadata e do Harvard Dataverse para a pasta <code>dados/</code>, com um manifesto de cada arquivo.</li>
          <li><b>Modelagem:</b> 14 migrações SQL em <code>banco/migracoes/</code> criam o esquema no PostgreSQL 17: território (UF, município, zona eleitoral), eleição e cargo, partido, político e candidatura, mandato, votação, perfil do eleitorado e contas de campanha.</li>
          <li><b>Carga:</b> <code>python -m loader PI</code> lê os CSVs de uma UF em blocos, grava em tabelas temporárias de preparação e passa para o esquema com SQL, ligando pessoas, partidos e zonas. No fim, atualiza as views materializadas de resumo.</li>
          <li><b>Respostas:</b> um script por questão em <code>scripts/</code> roda as consultas e grava o texto em <code>respostas/</code>.</li>
          <li><b>Site:</b> a API (FastAPI) roda as mesmas contas e este site desenha as respostas.</li>
        </ol>
        <Detalhe titulo="Desafios gerais">
          <ul className="list-disc space-y-2 pl-5">
            <li><b>Arquivos grandes e sujos:</b> os CSVs do TSE vêm em latin-1, separados por ponto e vírgula, e marcam ausência com <code>#NULO</code>, <code>#NE</code>, <code>-1</code>, <code>-3</code>, <code>-4</code> ou <code>NÃO DIVULGÁVEL</code>; tudo isso vira nulo na carga. Os arquivos nacionais são lidos em blocos e filtrados pela UF, para caber na memória.</li>
            <li><b>A mesma pessoa em 30 anos:</b> o <code>SQ_CANDIDATO</code> muda a cada eleição e se repete entre estados, então a candidatura tem chave própria (<code>id_politico_eleicao</code>). A pessoa é ligada pelo título eleitoral; sem ele, pelo CPF (mascarado em 2024); sem os dois, por nome e data de nascimento.</li>
            <li><b>Partidos que mudam:</b> o TSE reaproveita números (o 25 foi DEM e hoje é PRD), então a chave do partido é número e sigla juntos. Partidos fundidos ou incorporados herdam o viés de quem os sucedeu, e um gatilho preenche o viés de todo partido novo, em qualquer ordem de carga.</li>
            <li><b>Zona e município:</b> uma zona eleitoral pode cobrir vários municípios, então a tabela <code>zona_eleitoral</code> guarda a parte da zona dentro de cada município. O código de município do TSE (5 dígitos) é ligado ao do IBGE (7 dígitos) pelo arquivo de correspondência do próprio TSE.</li>
            <li><b>O que muda com o tempo fica na candidatura:</b> partido, número e nome de urna e escolaridade são guardados em cada candidatura, não na pessoa (migrações 011, 013 e 014).</li>
            <li><b>Volume e velocidade:</b> o perfil do eleitorado vem do arquivo de comparecimento, que já traz aptos e comparecimento por escolaridade (cerca de 7 GB a menos que o perfil completo). Somas que levavam segundos viraram views materializadas, e a malha dos mapas é simplificada sem abrir frestas entre municípios.</li>
          </ul>
        </Detalhe>
        <Detalhe titulo="As tabelas principais">
          <Origens
            linhas={[
              ['Pessoa', 'Nome, nascimento, título e CPF (estes nunca saem da API)', ARQ('politico')],
              ['Candidatura', 'Uma por pessoa e disputa: partido, número, nome de urna, escolaridade, situação', ARQ('politico_eleicao')],
              ['Disputa', 'Ano, turno, tipo, cargo e lugar (UF ou município)', ARQ('eleicao')],
              ['Eleito', 'A candidatura que venceu e em qual turno', ARQ('mandato')],
              ['Votos', 'Por candidatura e zona; por partido e município', <>{ARQ('votacao_candidato_munzona')}, {ARQ('votacao_partido_municipio')}</>],
              ['Quem votou', 'Aptos e comparecimento por zona e escolaridade', ARQ('perfil_eleitorado_munzona')],
              ['Contas', 'Despesas e receitas de cada candidatura', <>{ARQ('despesa_de_campanha')}, {ARQ('receita_de_campanha')}</>],
            ]}
          />
        </Detalhe>
      </Secao>

      <Secao id="m-cadeira" titulo="Custo da cadeira (P1)" resposta={{ para: '/cadeira', rotulo: 'Ver a resposta no plenário' }}>
        <p>
          O custo de uma cadeira é tudo o que <b>os eleitos</b> declararam ter contratado de despesa de
          campanha, dividido pelas <b>cadeiras preenchidas</b>. Mede quanto gastou, em média, quem levou a vaga.
        </p>
        <p className="rounded-xl border border-linha bg-folha px-5 py-4 text-tinta">
          custo da cadeira = Σ despesa contratada dos eleitos ÷ número de eleitos
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Gasto da disputa por cadeira:</b> despesa de todos os candidatos, eleitos ou não, ÷ cadeiras preenchidas. Mede quanto a disputa inteira gastou por vaga e é o total da prestação de contas.</li>
          <li><b>Despesa:</b> a contratada declarada ao TSE (2018 a 2024), sem as doações a outras campanhas, que reaparecem como despesa de quem recebeu.</li>
          <li><b>Inflação:</b> os valores são levados a reais de outubro de 2024 pelo IPCA de outubro de cada ano (IBGE, tabela 1737). O alternador mostra os valores da época.</li>
          <li><b>Preço de entrada:</b> a primeira faixa de gasto em que metade ou mais dos candidatos se elegeu (faixas com menos de 5 candidatos não contam).</li>
          <li><b>Eleito típico e quem perdeu:</b> a mediana do gasto de cada grupo, que não se deixa puxar por meia dúzia de campanhas milionárias.</li>
          <li><b>Custo por voto:</b> gasto da campanha ÷ votos nominais do 1º turno.</li>
          <li><b>Preço por partido:</b> despesa de todos os candidatos do partido ÷ cadeiras que ele conquistou.</li>
          <li>Vices e suplentes ficam de fora (gastaram R$ 0,2 mi nas quatro eleições); eleições suplementares também.</li>
        </ul>
        <Detalhe titulo="De onde vêm os dados">
          <Origens
            linhas={[
              ['Despesas contratadas', ARQ('tse/despesas_contratadas_candidatos/'), <>{ARQ('despesa_de_campanha')}, {ARQ('fornecedor')}</>],
              ['Receitas (fundo eleitoral, fundo partidário, doações, recursos próprios)', ARQ('tse/receitas_candidatos/'), ARQ('receita_de_campanha')],
              ['Candidaturas, partido e resultado', ARQ('tse/candidatos/'), <>{ARQ('politico_eleicao')}, {ARQ('mandato')}</>],
              ['Votos de cada candidato', ARQ('tse/votacao_candidato_munzona/'), ARQ('votacao_candidato_munzona')],
              ['IPCA de outubro (IBGE, SIDRA 1737)', 'gravado na migração 011', ARQ('ipca_outubro')],
            ]}
          />
        </Detalhe>
        <Detalhe titulo="Desafios">
          <ul className="list-disc space-y-2 pl-5">
            <li><b>Dinheiro contado duas vezes:</b> a doação de uma campanha a outra aparece como despesa de quem doa e de novo como despesa de quem recebe; a doação sai da conta.</li>
            <li><b>O partido de quem perdeu:</b> o banco só ligava partido ao mandato. A migração 011 grava o partido de toda candidatura, e o loader preenche o que já estava carregado.</li>
            <li><b>Reais de anos diferentes:</b> 2018 e 2024 só se comparam corrigidos pela inflação; o IPCA de outubro de cada ano ficou numa tabela.</li>
            <li><b>Lentidão:</b> somar despesas, receitas e votos de cada candidatura a cada pedido levava segundos; virou a view materializada <code>campanha</code>, atualizada no fim de cada carga.</li>
          </ul>
        </Detalhe>
        <Detalhe titulo="As consultas">
          <Consulta titulo="Gasto e votos de cada candidatura" sql={p1Campanha} />
          <Consulta titulo="Gasto de cada candidato, na época e em reais de 2024" sql={p1Gasto} />
        </Detalhe>
      </Secao>

      <Secao id="m-escolaridade" titulo="Escolaridade de quem é eleito e de quem vota (P4)" resposta={{ para: '/escola', rotulo: 'Ver a resposta na escola' }}>
        <p>
          Duas perguntas, para 2022 e 2024: a <b>escolaridade do candidato</b> muda a chance de ser eleito? E os lugares
          em que <b>quem vota</b> estudou menos elegem pessoas que estudaram menos? O TSE descreve candidato e eleitor
          com os mesmos oito graus, de analfabeto a superior completo, o que permite pôr os dois na mesma régua.
        </p>
        <p className="rounded-xl border border-linha bg-folha px-5 py-4 text-tinta">
          chance de ser eleito = eleitos ÷ candidaturas aptas, para cada grau de escolaridade e cargo
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Escolaridade do candidato:</b> a declarada naquela candidatura, não a de hoje; quem concorreu em 2022 e 2024 pode ter estudado entre as duas.</li>
          <li><b>Candidaturas aptas:</b> saem as indeferidas, renunciadas e cassadas antes da eleição. Ficam os titulares de eleições ordinárias, sem presidente, vices e suplentes.</li>
          <li><b>Quem vota:</b> o comparecimento do 1º turno por zona eleitoral, não o eleitorado apto inteiro.</li>
          <li><b>Comparar lugares:</b> em 2024 cada município elege prefeito e vereadores, então se compara quem votou ali com quem foi eleito ali. Em 2022 deputados são eleitos pelo estado; aí se mede em quem o município votou: a parcela dos votos nominais dados a candidatos com superior completo.</li>
          <li><b>Quintis:</b> os municípios em cinco grupos de mesmo tamanho, do eleitorado menos ao mais escolarizado.</li>
          <li><b>Força da relação:</b> V de Cramér para a chance de ser eleito (0 = nenhuma, 1 = total) e correlação de Pearson e de Spearman entre os municípios.</li>
          <li><b>Controle:</b> o eleitor declara a escolaridade ao tirar o título e quase nunca a atualiza, por isso o TSE fica abaixo da realidade. O Censo 2022 (pessoas de 18 anos ou mais) ordena os municípios quase igual (correlação 0,89) e dá as mesmas conclusões.</li>
        </ul>
        <Detalhe titulo="De onde vêm os dados">
          <Origens
            linhas={[
              [<>Escolaridade e situação de cada candidatura (<code>DS_GRAU_INSTRUCAO</code>, <code>DS_SIT_TOT_TURNO</code>)</>, ARQ('tse/candidatos/'), <>{ARQ('politico_eleicao.ds_grau_instrucao')}, {ARQ('ds_sit_tot_turno')}</>],
              ['Quem foi eleito', ARQ('tse/candidatos/'), ARQ('mandato')],
              [<>Escolaridade de quem compareceu (<code>DS_GRAU_ESCOLARIDADE</code>, <code>QT_COMPARECIMENTO</code>)</>, ARQ('tse/comparecimento_abstencao/'), ARQ('perfil_eleitorado_munzona')],
              ['Votos de cada candidato por zona', ARQ('tse/votacao_candidato_munzona/'), ARQ('votacao_candidato_munzona')],
              ['Os 8 graus em ordem', 'migração 014', ARQ('escolaridade')],
              ['Escolaridade da população adulta (controle)', ARQ('ibge/censo2022/nivel_instrucao_18mais_tabela10061.csv'), 'lido pelo script, sem tabela'],
            ]}
          />
        </Detalhe>
        <Detalhe titulo="Desafios">
          <ul className="list-disc space-y-2 pl-5">
            <li><b>A escolaridade estava na pessoa:</b> o banco guardava só a da candidatura mais recente, e 37% das candidaturas de 2022 herdavam a de uma candidatura posterior (em 699 ela era outra). A migração 014 grava a escolaridade de cada candidatura, e o loader preencheu o que já estava carregado.</li>
            <li><b>Quem não chegou às urnas:</b> candidaturas indeferidas, renunciadas e cassadas terminam sem situação (<code>#NULO</code> no TSE) e saem da conta, para não baixar a chance de ninguém.</li>
            <li><b>Duas pontas, uma régua:</b> candidato e eleitor usam os mesmos nomes de grau; a tabela <code>escolaridade</code> põe os 8 em ordem e liga as duas pontas.</li>
            <li><b>Escolaridade desatualizada:</b> a do eleitor é a do alistamento. O Censo 2022 confirmou a ordem dos municípios (correlação 0,89) e as conclusões.</li>
            <li><b>Deputado não é eleito pelo município:</b> em 2022 a comparação por lugar usa em quem o município votou, somando os votos zona a zona.</li>
            <li><b>Câmaras pequenas:</b> com 9 vereadores, um eleito vale 11 pontos percentuais; por isso os municípios são comparados em quintos, não um a um.</li>
          </ul>
        </Detalhe>
        <Detalhe titulo="As consultas">
          <Consulta titulo="Chance de ser eleito por grau e cargo" sql={p4Chance} />
          <Consulta titulo="O lugar e quem ele elege (2024)" sql={p4Lugar} />
          <Consulta titulo="O lugar e em quem ele vota (2022)" sql={p4Votos} />
        </Detalhe>
      </Secao>

      <Secao id="m-vies" titulo="Viés político (P7)" resposta={{ para: '/', rotulo: 'Ver a resposta no mapa' }}>
        <p>
          Cada partido tem um viés de <b>−100 (esquerda)</b> a <b>+100 (direita)</b>, a partir da classificação de
          especialistas de Bolognesi, Codato, Ribeiro e Silva (Harvard Dataverse). O viés de um município num ano é a média
          desses vieses <b>ponderada pelos votos válidos</b> (nominais e de legenda) que cada partido recebeu ali, somando
          todos os cargos do 1º turno.
        </p>
        <p className="rounded-xl border border-linha bg-folha px-5 py-4 text-tinta">
          viés do município = Σ (votos válidos do partido × viés do partido) ÷ Σ votos válidos
        </p>
        <p>Estados e regiões intermediárias usam a mesma média sobre os votos de todos os seus municípios.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>2018 e 2022 somam presidente, governador, senado e deputados; 2020 e 2024, prefeito e vereador. Compare anos do mesmo tipo.</li>
          <li>Em 2018 cada eleitor tinha dois votos para o Senado, então o Senado pesa o dobro nesse ano.</li>
          <li>Partidos sem viés informado entram como 0 e puxam a média para o centro; cada boletim mostra a parcela desses votos.</li>
          <li>Partidos extintos herdam o viés de quem os sucedeu (fusões e incorporações).</li>
        </ul>
        <Detalhe titulo="De onde vêm os dados">
          <Origens
            linhas={[
              ['Votos de cada partido, nominais e de legenda', ARQ('tse/votacao_partido_munzona/'), <>{ARQ('votacao_partido_munzona')}, somada em {ARQ('votacao_partido_municipio')}</>],
              ['Viés dos partidos (especialistas)', ARQ('ideologia_partidos/df_experts.csv'), <>{ARQ('partido.vies_politico')} (migrações 006 a 009)</>],
              ['Municípios e regiões intermediárias', ARQ('ibge/territorio/'), ARQ('municipio')],
              ['Contorno dos estados e municípios', ARQ('ibge/malhas/'), 'lidas e simplificadas pela API'],
              ['Código do município no TSE e no IBGE', ARQ('tse/municipio_tse_ibge/'), ARQ('municipio.cd_ibge')],
            ]}
          />
        </Detalhe>
        <Detalhe titulo="Desafios">
          <ul className="list-disc space-y-2 pl-5">
            <li><b>Partidos que mudam de nome, se fundem ou são incorporados:</b> o viés vale para os nomes antigos do mesmo partido (migração 006), os extintos herdam o de quem os sucedeu (007 e 008), e um gatilho grava o viés de qualquer partido que a carga inserir depois (009).</li>
            <li><b>Ausência visível:</b> partido sem viés informado entra como 0 e puxa a média para o centro; o boletim de cada município mostra quanto do voto foi para esses partidos.</li>
            <li><b>Eleições diferentes:</b> anos gerais e municipais têm cargos diferentes, e em 2018 o Senado tinha duas vagas por estado.</li>
            <li><b>De onde vem o viés de um estado:</b> somar os votos de cada candidato zona a zona levava 4,7 s na Bahia; a view <code>votos_candidato_uf</code> (migração 012) faz o mesmo em 0,07 s.</li>
            <li><b>Mapa leve:</b> a malha do IBGE é simplificada preservando as fronteiras comuns, e os municípios só entram depois que a câmera pousa no estado.</li>
          </ul>
        </Detalhe>
        <Detalhe titulo="As consultas">
          <Consulta titulo="Na carga: votos de cada partido no município" sql={p7VotosPartido} />
          <Consulta titulo="O viés de cada município, ano a ano" sql={p7Vies} />
        </Detalhe>
      </Secao>

      <Secao id="m-carreira" titulo="Carreira do político (P10)" resposta={{ para: '/urna', rotulo: 'Ver a resposta na urna' }}>
        <p>
          A pessoa é identificada entre eleições pelo <b>título eleitoral</b>; sem ele, pelo CPF; sem os dois, por nome e
          data de nascimento. As candidaturas vão de 1994 a 2024.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Reeleição:</b> eleito para o mesmo cargo, na mesma UF ou município, na eleição ordinária anterior (quatro anos antes; oito para senador).</li>
          <li><b>Votos:</b> nominais do 1º turno, disponíveis de 2018 a 2024 nos estados carregados.</li>
          <li><b>Partido:</b> o da candidatura, eleita ou não.</li>
          <li><b>Privacidade:</b> CPF, título eleitoral e data completa de nascimento nunca aparecem; só o ano.</li>
          <li><b>Fotos:</b> as fotos de registro que o TSE publica desde 2004.</li>
        </ul>
        <p>
          A taxa de reeleição de cada cargo, eleição a eleição e estado a estado (P10a), está na página{' '}
          <Link to="/reeleicao" className="font-semibold text-acao underline underline-offset-4">Reeleição</Link>; o método,{' '}
          <a href="#m-reeleicao" className="font-semibold text-acao underline underline-offset-4">logo abaixo</a>.
        </p>
        <Detalhe titulo="De onde vêm os dados">
          <Origens
            linhas={[
              ['Candidaturas de 1994 a 2024', ARQ('tse/candidatos/'), <>{ARQ('politico')}, {ARQ('politico_eleicao')}, {ARQ('mandato')}</>],
              [<>Número e nome de urna (<code>NR_CANDIDATO</code>, <code>NM_URNA_CANDIDATO</code>)</>, ARQ('tse/candidatos/'), <>{ARQ('politico_eleicao')} (migração 013)</>],
              ['Votos de 2018 a 2024', ARQ('tse/votacao_candidato_munzona/'), ARQ('votacao_candidato_munzona')],
              ['Gasto da campanha', ARQ('tse/despesas_contratadas_candidatos/'), <>view {ARQ('campanha')}</>],
              ['Fotos de registro (desde 2004)', ARQ('tse/fotos_candidatos/'), 'lidas direto do zip pela API'],
            ]}
          />
        </Detalhe>
        <Detalhe titulo="Desafios">
          <ul className="list-disc space-y-2 pl-5">
            <li><b>Ligar a mesma pessoa:</b> em 1994 e 1996 metade das candidaturas não tem título eleitoral, e em 2024 o CPF vem mascarado. Para a reeleição, quem não tem título também é ligado pelo nome normalizado (sem acento, Z = S, Y = I) ou pela mesma data de nascimento com o mesmo primeiro nome.</li>
            <li><b>Quem tentou a reeleição:</b> o banco não guarda essa marca do TSE, então a tentativa é deduzida: candidato ao mesmo cargo, no mesmo lugar, na eleição seguinte.</li>
            <li>
              <b>Eleito cassado depois da eleição:</b> quem venceu é quem a tabela de candidatos do TSE marca como eleito. Quando o
              eleito perde o diploma, o TSE registra a cassação na candidatura dele e passa o <code>ELEITO</code> para quem assumiu,
              e seguimos essa tabela. É o caso de Mão Santa, no Piauí: eleito governador em 1994, venceu o 2º turno de 1998 e
              governou até ter o diploma cassado pelo TSE em 2001. Na tabela de 1998 ele aparece como{' '}
              <code>RENÚNCIA/FALECIMENTO/CASSAÇÃO APÓS A ELEIÇÃO</code>, e Hugo Napoleão, o segundo colocado, como{' '}
              <code>ELEITO</code>. Por isso, na taxa de reeleição, Mão Santa conta como quem tentou e não voltou, e na carreira o
              mandato de 1998 é de Hugo Napoleão. Não corrigimos casos à mão: as cerca de 150 candidaturas com registro negado
              ou cassação depois da eleição (2000 a 2010, quase todas de vereador) não podem ser conferidas, porque os votos por
              candidato só estão no banco de 2018 em diante, e corrigir só o caso conhecido criaria uma exceção.
            </li>
            <li><b>Vices e suplentes:</b> o TSE só os marca como eleitos a partir de 2012 (municipais) e 2014 (gerais), então ficam fora da taxa de reeleição.</li>
            <li><b>Nome de urna cortado:</b> nos anos 90 o TSE cortava o nome de urna em 30 letras; o santinho termina na última palavra inteira.</li>
            <li><b>Busca pelo nome:</b> sem diferenciar acento e tolerante a erros de digitação, com índice de trigramas (<code>pg_trgm</code>) sobre o nome sem acentos (migração 010).</li>
          </ul>
        </Detalhe>
        <Detalhe titulo="As consultas">
          <Consulta titulo="A carreira de um político" sql={p10Carreira} />
          <Consulta titulo="Taxa de reeleição por cargo e ano" sql={p10Reeleicao} />
        </Detalhe>
      </Secao>

      <Secao id="m-reeleicao" titulo="Taxa de reeleição (P10a)" resposta={{ para: '/reeleicao', rotulo: 'Ver a resposta na reeleição' }}>
        <p>
          Dos eleitos para um cargo em cada eleição, quantos disputaram o mesmo cargo no mesmo lugar na eleição seguinte e
          quantos venceram de novo. Por padrão a página soma todos os estados carregados; cada estado pode ser visto sozinho.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Tentou a reeleição:</b> foi candidato ao mesmo cargo, na mesma UF ou município, na eleição ordinária seguinte (senador, oito anos depois). O banco não guarda a marca de reeleição do TSE, então candidaturas indeferidas ou renunciadas também contam.</li>
          <li><b>Taxa de reeleição:</b> dos que tentaram, quantos venceram. No caminho dos eleitos, a largura de cada fita é a quantidade de pessoas; a tira das fichas de cargo divide os eleitos em 100, pelo maior resto.</li>
          <li><b>Fora da conta:</b> eleições suplementares, presidente (disputa nacional) e vices e suplentes, que o TSE só marca como eleitos a partir de 2012 e 2014.</li>
          <li><b>A mesma pessoa:</b> ligada entre eleições pelo título eleitoral. Em 1994 e 1996 metade das candidaturas não tem título; aí a tentativa também é achada pelo nome normalizado ou pela data de nascimento com o mesmo primeiro nome.</li>
          <li><b>Ainda sem a eleição seguinte:</b> os eleitos da última eleição de cada cargo (2022 nas gerais, 2024 nas municipais, 2018 e 2022 para senador) ficam de fora até a próxima eleição entrar no banco.</li>
          <li><b>Prefeito e vereador:</b> além da soma, a média simples das taxas dos municípios em que alguém tentou, para cidades grandes não pesarem mais.</li>
          <li><b>Estado a estado:</b> casas com menos de 10 tentativas ficam hachuradas; poucos casos mudam muito a taxa.</li>
          <li><b>Quem são:</b> os eleitos de cada eleição, separados pelo que fizeram na seguinte, com os mais votados primeiro (há votos de 2018 em diante).</li>
        </ul>
      </Secao>

      <Secao id="m-fontes" titulo="Fontes">
        <ul className="space-y-2">
          <li><b>TSE, Portal de Dados Abertos</b> (<a className="text-acao underline underline-offset-4" href="https://dadosabertos.tse.jus.br" target="_blank" rel="noreferrer">dadosabertos.tse.jus.br</a>): candidaturas, votação por município e zona, comparecimento por escolaridade, prestação de contas, correspondência de municípios e fotos.</li>
          <li><b>IBGE, SIDRA</b> (<a className="text-acao underline underline-offset-4" href="https://sidra.ibge.gov.br" target="_blank" rel="noreferrer">sidra.ibge.gov.br</a>): IPCA de outubro (tabela 1737), PIB municipal (5938), população estimada (6579), Censo 2022 (4709, idade 9515 e nível de instrução das pessoas de 18 anos ou mais, 10061).</li>
          <li><b>IBGE, APIs de malhas e localidades:</b> contornos dos estados e municípios (GeoJSON) e regiões intermediárias.</li>
          <li><b>Atlas Brasil (PNUD, Ipea, FJP)</b>, pelo Ipeadata: IDHM; o mais recente é o do Censo 2010.</li>
          <li><b>Harvard Dataverse:</b> classificação ideológica dos partidos por especialistas (Bolognesi, Codato, Ribeiro e Silva).</li>
        </ul>
      </Secao>

      <Secao id="m-limites" titulo="Limitações">
        <ul className="list-disc space-y-2 pl-5">
          <li>Só os estados carregados no banco têm viés; os demais aparecem hachurados como <i>sem dados carregados</i>.</li>
          <li>O viés mede o voto em partidos, não a opinião dos eleitores.</li>
          <li>A escolaridade do eleitor é a declarada no alistamento eleitoral e subestima a real; a do candidato é a que ele declarou ao registrar a candidatura.</li>
          <li>Nomes vêm do registro civil no TSE, em maiúsculas e às vezes sem acento.</li>
          <li>Este é um projeto acadêmico; não é um site oficial da Justiça Eleitoral.</li>
        </ul>
      </Secao>

      <Secao id="m-reproduzir" titulo="Para reproduzir">
        <ol className="list-decimal space-y-2 pl-5">
          <li><code>python -m crawler</code> baixa os dados; <code>python -m crawler --fotos</code>, as fotos.</li>
          <li><code>docker compose up -d</code> sobe o PostgreSQL e aplica as migrações.</li>
          <li><code>python -m loader PI BA</code> carrega os estados.</li>
          <li><code>python scripts/04_escolaridade.py</code> (e os outros scripts) gravam as respostas em <code>respostas/</code>.</li>
          <li><code>python -m uvicorn api.app:app --port 8000</code> sobe a API.</li>
          <li><code>npm run dev</code> na pasta <code>web</code> abre este site.</li>
        </ol>
      </Secao>
    </article>
  )
}
