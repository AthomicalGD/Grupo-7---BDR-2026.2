// P8: quem depende de repasses públicos se elege mais? Repasse público = fundo eleitoral (FEFC) + fundo partidário.
// Dois gráficos sobre o mesmo recorte (cargo, eleição, estado ou município): (1) a taxa de eleição por faixa de
// parcela pública da receita, em faixas iguais (padrão 5, de 20 em 20 pontos), com a parcela média de eleitos e
// não eleitos e os dois casos que fogem da regra; (2) a taxa por valor recebido, em quartis, com quem não recebeu
// nada à parte, a média de recebimento e, de novo, os dois casos extremos. Conta em api/app.py (conta_repasses).
import { X } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { CARGOS_P1, consultas, semMunicipal, type Ano, type PessoaRepasse, type Repasses } from '../api'
import { BuscaMunicipio } from '../atlas/BuscaMunicipio'
import { CedulaAnos } from '../atlas/CedulaAnos'
import { Atrasado, EsqueletoBloco, EsqueletoPagina } from '../componentes/Esqueleto'
import { ErroCarga } from '../componentes/ErroCarga'
import { Escolha } from '../componentes/Escolha'
import { Retrato } from '../componentes/Retrato'
import { SeletorEstado } from '../componentes/SeletorEstado'
import { inteiro, noEstado, nomeProprio, pct, reais, reaisCurto, ufsFrase } from '../lib/formato'
import type { BuscaRepasses } from '../router'
import { BarrasTaxa, type BarraTaxa } from './BarrasTaxa'
import { PatrimonioRecursosSecao } from './PatrimonioRecursos'

const FAIXAS = [2, 3, 4, 5, 6, 7, 8, 9, 10]
const CINZA = '#8a929b'
const b = (t: string) => <b className="tabular font-bold text-tinta">{t}</b>
const pontos = (n: number) => `${inteiro(Math.round(Math.abs(n)))} ${Math.round(Math.abs(n)) === 1 ? 'ponto' : 'pontos'}`

/** Um candidato que foge da regra, com foto, a conta dele e o link para a carreira. */
function Caso({ titulo, pessoa, valor, empate }: { titulo: string; pessoa: PessoaRepasse | null; valor: (p: PessoaRepasse) => string; empate: (n: number) => string }) {
  return (
    <div className="rounded-[18px] border border-linha bg-folha p-4">
      <p className="t-rotulo text-tinta-3">{titulo}</p>
      {pessoa ? (
        <Link to="/politico/$id" params={{ id: String(pessoa.id) }} className="group mt-3 flex items-start gap-3.5">
          <Retrato foto={pessoa.foto} nome={pessoa.nome} tamanho={52} />
          <span className="min-w-0">
            <span className="block font-bold text-tinta group-hover:underline">{nomeProprio(pessoa.nome)}</span>
            <span className="block text-[0.85rem] text-tinta-2">
              {pessoa.partido ?? 'Sem partido'} · {pessoa.local ? `${pessoa.local} (${pessoa.uf})` : pessoa.uf} · {inteiro(pessoa.votos)} votos
            </span>
            <span className="mt-1.5 block text-[0.92rem] text-tinta">{valor(pessoa)}</span>
            <span className="block text-[0.8rem] text-tinta-3">
              {reaisCurto(pessoa.publico)} de fundos públicos em {reaisCurto(pessoa.total)} de receita
            </span>
            {pessoa.empatados > 0 && <span className="mt-1 block text-[0.8rem] text-tinta-3">{empate(pessoa.empatados)}</span>}
          </span>
        </Link>
      ) : (
        <p className="mt-3 text-[0.92rem] text-tinta-2">Ninguém neste grupo.</p>
      )}
    </div>
  )
}

/** Dois números lado a lado: eleitos contra não eleitos. */
function Duelo({ titulo, eleitos, naoEleitos, formato, nota }: { titulo: string; eleitos: number | null; naoEleitos: number | null; formato: (n: number | null) => string; nota?: string }) {
  return (
    <div className="rounded-[18px] border border-linha bg-folha p-4">
      <p className="t-rotulo text-tinta-3">{titulo}</p>
      <dl className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-[0.85rem] font-semibold text-tinta-2">Eleitos</dt>
          <dd className="t-numero tabular text-[clamp(1.4rem,1.1rem+0.8vw,1.9rem)] leading-tight">{formato(eleitos)}</dd>
        </div>
        <div>
          <dt className="text-[0.85rem] font-semibold text-tinta-2">Não eleitos</dt>
          <dd className="t-numero tabular text-[clamp(1.4rem,1.1rem+0.8vw,1.9rem)] leading-tight">{formato(naoEleitos)}</dd>
        </div>
      </dl>
      {nota && <p className="mt-2 text-[0.8rem] text-tinta-3">{nota}</p>}
    </div>
  )
}

function Parcela({ dados, faixas, aoFaixas }: { dados: Repasses; faixas: number; aoFaixas: (n: number) => void }) {
  const p = dados.parcela
  const cheias = p.faixas.filter((f) => f.candidatos >= 5)
  const [baixa, alta] = [cheias[0], cheias.at(-1)]
  const diferenca = p.media_eleitos != null && p.media_nao_eleitos != null ? p.media_eleitos - p.media_nao_eleitos : null
  return (
    <>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <fieldset className="min-w-0">
          <legend className="t-rotulo mb-2 text-tinta-2">Dividir em quantas faixas</legend>
          <div role="radiogroup" aria-label="Número de faixas" className="flex flex-wrap gap-1.5">
            {FAIXAS.map((n) => (
              <Escolha key={n} ativo={n === faixas} aoClicar={() => aoFaixas(n)} rotulo={`${n} faixas de ${inteiro(100 / n)} pontos`}>
                {n}
              </Escolha>
            ))}
          </div>
        </fieldset>
        <p className="text-[0.88rem] text-tinta-2">
          Cada faixa tem {b(`${(100 / faixas).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pontos`)} de parcela pública.
        </p>
      </div>
      <div className="mt-6">
        <BarrasTaxa
          key={faixas}
          grupos={p.faixas}
          geral={dados.resumo.taxa}
          titulo={`Eleitos por parcela pública da receita: ${dados.cargo.nome.toLowerCase()}, ${dados.ano}`}
          descricao={p.faixas.map((f) => `${f.rotulo}: ${f.taxa == null ? 'vazia' : pct(f.taxa, 0)} de ${inteiro(f.candidatos)}`).join('; ')}
          colunaGrupo="Parcela pública da receita"
          sql="p8Repasses"
        />
      </div>
      {baixa && alta && baixa !== alta && (
        <p className="mt-6 max-w-[64ch] text-[1.02rem] leading-relaxed text-tinta-2">
          Na faixa de menos dinheiro público ({baixa.rotulo}), {b(pct(baixa.taxa, 0))} se elegeram; na de mais ({alta.rotulo}), {b(pct(alta.taxa, 0))}.
          {diferenca != null && (
            <> Em média, {Math.abs(diferenca) < 1 ? 'eleitos e não eleitos dependem quase igual dos fundos' : <>a receita dos eleitos tem {b(pontos(diferenca))} {diferenca > 0 ? 'a mais' : 'a menos'} de fundos públicos que a dos não eleitos</>}.</>
          )}
        </p>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Duelo titulo="Parcela pública média" eleitos={p.media_eleitos} naoEleitos={p.media_nao_eleitos} formato={(n) => pct(n, 0)} nota="Média simples da parcela de cada candidato." />
        <Caso
          titulo="Eleito com a menor parcela pública"
          pessoa={p.eleito_menor}
          valor={(x) => `${pct(x.parcela, 1)} da receita veio de fundos públicos`}
          empate={(n) => `${n === 1 ? 'Outro eleito' : `Outros ${inteiro(n)} eleitos`} ${n === 1 ? 'tem' : 'têm'} a mesma parcela; aparece o de maior receita.`}
        />
        <Caso
          titulo="Não eleito com a maior parcela pública"
          pessoa={p.nao_eleito_maior}
          valor={(x) => `${pct(x.parcela, 1)} da receita veio de fundos públicos`}
          empate={(n) => `${n === 1 ? 'Outro não eleito' : `Outros ${inteiro(n)} não eleitos`} ${n === 1 ? 'tem' : 'têm'} a mesma parcela; aparece o de maior receita.`}
        />
      </div>
    </>
  )
}

function Valor({ dados }: { dados: Repasses }) {
  const v = dados.valor
  const grupos: BarraTaxa[] = v.grupos.map((g) => ({
    ...g,
    rotulo: g.id === 'zero' ? 'Nada' : g.rotulo,
    detalhe: g.id === 'zero' ? 'R$ 0' : g.de === g.ate ? reaisCurto(g.de) : `${reaisCurto(g.de)} a ${reaisCurto(g.ate)}`,
    cor: g.id === 'zero' ? CINZA : undefined,
  }))
  return (
    <>
      <div className="mt-6">
        <BarrasTaxa
          grupos={grupos}
          geral={dados.resumo.taxa}
          titulo={`Eleitos por valor recebido de fundos públicos: ${dados.cargo.nome.toLowerCase()}, ${dados.ano}`}
          descricao={grupos.map((g) => `${g.rotulo} (${g.detalhe}): ${pct(g.taxa, 0)} de ${inteiro(g.candidatos)}`).join('; ')}
          colunaGrupo="Repasse público recebido"
          sql="p8Repasses"
        />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4">
          <div className="rounded-[18px] border border-linha bg-folha p-4">
            <p className="t-rotulo text-tinta-3">Média de recebimento</p>
            <p className="t-numero tabular mt-2 text-[clamp(1.8rem,1.3rem+1.2vw,2.5rem)] leading-tight">{reaisCurto(v.media)}</p>
            <p className="text-[0.85rem] text-tinta-2">por candidato com receita ({inteiro(dados.resumo.com_receita)})</p>
            <p className="mt-2 text-[0.85rem] text-tinta-2">Só entre os que receberam algo: {b(reaisCurto(v.media_receberam))}</p>
          </div>
          <Duelo titulo="Média recebida" eleitos={v.media_eleitos} naoEleitos={v.media_nao_eleitos} formato={reaisCurto} />
        </div>
        <Caso
          titulo="Eleito que menos recebeu"
          pessoa={v.eleito_menor}
          valor={(x) => (x.publico > 0 ? `Recebeu ${reais(x.publico)} de fundos públicos` : 'Não recebeu nada de fundos públicos')}
          empate={(n) => `${n === 1 ? 'Outro eleito' : `Outros ${inteiro(n)} eleitos`} ${n === 1 ? 'recebeu' : 'receberam'} o mesmo valor; aparece o de maior receita.`}
        />
        <Caso
          titulo="Não eleito que mais recebeu"
          pessoa={v.nao_eleito_maior}
          valor={(x) => `Recebeu ${reais(x.publico)} de fundos públicos`}
          empate={(n) => `${n === 1 ? 'Outro não eleito' : `Outros ${inteiro(n)} não eleitos`} ${n === 1 ? 'recebeu' : 'receberam'} o mesmo valor; aparece o de maior receita.`}
        />
      </div>
    </>
  )
}

export function RepassesPagina() {
  const busca = useSearch({ from: '/repasses' })
  const navegar = useNavigate({ from: '/repasses' })
  const mudar = (s: Partial<BuscaRepasses>) => navegar({ search: (a) => ({ ...a, ...s }), replace: true, resetScroll: false })
  const { data: ufs } = useQuery(consultas.ufs())
  const { data: malha } = useQuery(consultas.malhaBrasil())
  const carregadas = useMemo(() => (ufs ?? []).filter((u) => u.carregada && u.sigla !== 'BR'), [ufs])
  const [aviso, setAviso] = useState('')

  const cargo = CARGOS_P1.find((c) => c.cod === busca.cargo) ?? CARGOS_P1[0]
  // 2026 com a prestação de contas final do 1º turno (a do 2º turno ainda não saiu: aviso logo abaixo do resumo)
  const anos: Ano[] = cargo.municipal ? [2020, 2024] : [2018, 2022, 2026]
  const ano = busca.ano && anos.includes(busca.ano) ? busca.ano : anos[anos.length - 1]
  const vereador = cargo.cod === 13
  const lugares = useMemo(() => semMunicipal(carregadas, cargo.municipal), [carregadas, cargo.municipal])
  // vereador do Brasil inteiro são centenas de milhares de candidatos: sempre um estado (o Piauí, se houver)
  const ufValida = busca.uf && lugares.some((u) => u.sigla === busca.uf) ? busca.uf : ''
  const uf = ufValida || (vereador ? (lugares.find((u) => u.sigla === 'PI') ?? lugares[0])?.sigla ?? '' : '')
  const municipio = cargo.municipal ? busca.municipio : undefined
  const faixas = busca.faixas ?? 5
  const q = useQuery({ ...consultas.repasses(ano, cargo.cod, municipio ? '' : uf, municipio, faixas), enabled: !!ufs && (!vereador || !!uf || !!municipio), placeholderData: keepPreviousData })
  const dados = q.data
  const qp = useQuery({ ...consultas.repassesPatrimonio(ano, cargo.cod, municipio ? '' : uf, municipio), enabled: !!ufs && (!vereador || !!uf || !!municipio), placeholderData: keepPreviousData })

  useEffect(() => {
    document.title = 'Quem depende de dinheiro público se elege mais? · Voto Aberto'
  }, [])

  if (!ufs) return <Atrasado><EsqueletoPagina rotulo="Somando os repasses..." /></Atrasado>

  const ufDados = dados && carregadas.find((u) => u.sigla === dados.escopo.ufs[0])
  const lugar = !dados
    ? ''
    : dados.escopo.municipio
      ? `em ${dados.escopo.municipio.nome} (${dados.escopo.ufs[0]})`
      : dados.escopo.ufs.length === 1 && ufDados ? noEstado(ufDados.sigla, ufDados.nome) : ufsFrase(dados.escopo.ufs, 'nos')
  const r = dados?.resumo

  return (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-20 pt-6 md:px-[var(--casca-margem)] md:pt-7">
      <div className="mx-auto max-w-[var(--miolo-max)]">
        <header>
          <h1 className="t-display">Quem depende de dinheiro público se elege mais?</h1>
          <p className="mt-3 max-w-[60ch] text-[1.06rem] text-tinta-2">
            Repasse público é o que a campanha recebeu do fundo eleitoral e do fundo partidário. Compare a chance de se
            eleger de quem depende mais desse dinheiro com a de quem se financiou por outras fontes.
          </p>
        </header>

        <div className="mt-6 grid gap-x-10 gap-y-4 xl:grid-cols-[minmax(0,1.25fr)_auto]">
          <fieldset className="min-w-0">
            <legend className="t-rotulo mb-2 text-tinta-2">Cargo</legend>
            <div role="radiogroup" aria-label="Cargo" className="flex flex-wrap gap-2">
              {CARGOS_P1.map((c) => (
                <Escolha key={c.cod} ativo={c.cod === cargo.cod} aoClicar={() => mudar({ cargo: c.cod, ano: undefined, municipio: undefined })}>
                  {c.nome}
                </Escolha>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="t-rotulo mb-2 text-tinta-2">Eleição</legend>
            <CedulaAnos ano={ano} anos={anos} linhaDoTempo={false} aoMudar={(a) => mudar({ ano: a })} />
          </fieldset>
          <fieldset className="min-w-0 xl:col-span-2">
            <legend className="t-rotulo mb-2 text-tinta-2">{cargo.municipal ? 'Estado ou município' : 'Estado'}</legend>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-full sm:w-[300px]">
                <SeletorEstado malha={malha} ufs={lugares} escolhida={municipio ? '' : uf} obrigatorio={vereador} aoEscolher={(s) => mudar({ uf: s, municipio: undefined })} />
              </div>
              {cargo.municipal && (
                <div className="flex min-w-[min(100%,340px)] flex-1 flex-wrap items-center gap-3">
                  <div className="min-w-[240px] flex-1">
                    <BuscaMunicipio
                      rotulo="Ou um município"
                      aoEscolher={(m) => {
                        setAviso(m.carregada ? '' : `${m.nome} (${m.uf}) ainda não foi carregado no banco.`)
                        if (m.carregada) mudar({ uf: m.uf, municipio: m.ibge })
                      }}
                    />
                  </div>
                  {municipio && dados?.escopo.municipio && (
                    <button type="button" onClick={() => mudar({ municipio: undefined })} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-linha bg-folha px-3 text-[0.86rem] font-semibold text-tinta hover:border-linha-2">
                      {dados.escopo.municipio.nome} <X size={13} weight="bold" aria-label="Voltar ao estado inteiro" />
                    </button>
                  )}
                  {aviso && <p className="text-[0.9rem] text-tinta-2" aria-live="polite">{aviso}</p>}
                </div>
              )}
            </div>
          </fieldset>
        </div>

        {q.error && dados && (
          <p role="alert" className="mt-6 rounded-xl border border-corrige/40 bg-folha px-4 py-3 text-[0.9rem]">
            Não foi possível abrir esta seleção ({q.error.message}). Abaixo, a anterior.
          </p>
        )}

        {!dados ? (
          q.error ? <div className="mt-10"><ErroCarga erro={q.error} aoTentar={q.refetch} /></div> : <Atrasado><div className="mt-10"><EsqueletoBloco altura={360} linhas={0} rotulo="Somando os repasses..." /></div></Atrasado>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={`transition-opacity duration-300 ${q.isPlaceholderData ? 'opacity-55' : ''}`}>
            {q.isPlaceholderData && <span className="sr-only" role="status">Somando os repasses...</span>}
            <p className="mt-8 max-w-[64ch] text-[clamp(1.1rem,0.95rem+0.55vw,1.3rem)] font-medium leading-[1.45] text-tinta-2" style={{ fontStretch: '96%' }}>
              Em {dados.ano}, {b(inteiro(r!.com_receita))} candidatos a {dados.cargo.nome.toLowerCase()} {lugar} declararam receita, e{' '}
              {b(pct(r!.taxa, 0))} deles se elegeram. {b(inteiro(r!.receberam))} receberam algo dos fundos públicos.
              {r!.sem_receita.candidatos > 0 && (
                <span className="text-[0.85em] text-tinta-3"> Outros {inteiro(r!.sem_receita.candidatos)} não declararam receita nenhuma e ficam fora das contas ({inteiro(r!.sem_receita.eleitos)} deles se elegeram).</span>
              )}
            </p>
            {dados.ano === 2026 && (
              <p className="mt-4 max-w-[72ch] rounded-xl border border-escolha/50 bg-escolha-claro px-4 py-3 text-[0.9rem] text-tinta">
                <b>2026:</b> receitas da prestação de contas final do 1º turno, publicada pelo TSE em 04/11/2026.
                {dados.cargo.cod === 3
                  ? ' Quem foi ao 2º turno ainda não entregou a prestação final dessa etapa: do dinheiro do 2º turno, só entra o que já está no relatório financeiro parcial.'
                  : ' Este cargo foi decidido no 1º turno, então as contas estão completas.'}
              </p>
            )}

            {r!.com_receita === 0 ? (
              <p className="mt-10 text-tinta-2">Nenhum candidato com receita declarada nesta seleção.</p>
            ) : (
              <>
                <section aria-labelledby="parcela" className="mt-14">
                  <h2 id="parcela" className="t-h2">Quanto da receita veio de fundos públicos</h2>
                  <Parcela dados={dados} faixas={faixas} aoFaixas={(n) => mudar({ faixas: n === 5 ? undefined : n })} />
                </section>

                <section aria-labelledby="valor" className="mt-20">
                  <h2 id="valor" className="t-h2">Quanto recebeu de fundos públicos</h2>
                  <p className="mt-3 max-w-[64ch] text-tinta-2">
                    O valor em reais, sem olhar o resto da receita. Quem recebeu foi dividido em quartis; quem não recebeu nada fica numa barra à parte.
                  </p>
                  <Valor dados={dados} />
                </section>

                <section aria-labelledby="ricos" className="mt-20">
                  <h2 id="ricos" className="t-h2">Para quem foi o dinheiro: patrimônio dos candidatos</h2>
                  {qp.data ? (
                    <div aria-busy={qp.isPlaceholderData} className={`transition-opacity duration-300 ${qp.isPlaceholderData ? 'opacity-55' : ''}`}>
                      <PatrimonioRecursosSecao dados={qp.data} dinheiro={busca.dinheiro ?? 'publico'} aoDinheiro={(d) => mudar({ dinheiro: d === 'receita' ? 'receita' : undefined })} />
                    </div>
                  ) : qp.error ? (
                    <div className="mt-6"><ErroCarga erro={qp.error} compacto aoTentar={qp.refetch} /></div>
                  ) : (
                    <Atrasado><div className="mt-6"><EsqueletoBloco altura={320} linhas={0} rotulo="Somando os bens..." /></div></Atrasado>
                  )}
                </section>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
