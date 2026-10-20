// P1: Quanto custa uma cadeira? O plenário é a resposta: cada cadeira é um eleito, na cor do que
// a campanha dele gastou, e no miolo o custo da cadeira (gasto de todos os candidatos ÷ vagas).
import { Cube, Square } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { CARGOS_P1, consultas, semMunicipal, type Ano, type Cadeira, type UF } from '../api'
import { BuscaMunicipio } from '../atlas/BuscaMunicipio'
import { CedulaAnos } from '../atlas/CedulaAnos'
import { Alternador } from '../atlas/PainelEstado'
import { SeletorEstado } from '../componentes/SeletorEstado'
import { Ciranda, CirandaTela } from '../componentes/Ciranda'
import { ErroCarga } from '../componentes/ErroCarga'
import { Escolha } from '../componentes/Escolha'
import { Fita } from '../componentes/Fita'
import { CAPITAIS } from '../lib/capitais'
import { inteiro, noEstado as noEstadoUF, plural, reaisCurto } from '../lib/formato'
import type { BuscaCadeira } from '../router'
import { CurvaVitoria } from './CurvaVitoria'
import { CustoVoto } from './CustoVoto'
import { Fontes, Recibo } from './Dinheiro'
import { corRampa, entrada, escalaGasto } from './geometria'
import { BuscaAssento } from './BuscaAssento'
import { Plenario } from './Plenario'
import { PrecoPartidos } from './PrecoPartidos'

const Plenario3D = lazy(() => import('./Plenario3D'))

const noEstado = (u: UF) => noEstadoUF(u.sigla, u.nome)

function Lede({ dados, ano, outro, cargo, lugar }: { dados: Cadeira; ano: number; outro: number; cargo: string; lugar: string }) {
  const r = dados.resumo, f = dados.ipca
  const fator = f[String(ano)]
  const o = dados.anos[String(outro)]
  const real = r.custo_cadeira && o?.custo_cadeira ? (r.custo_cadeira * fator) / (o.custo_cadeira * f[String(outro)]) - 1 : null
  const vezes = r.mediana_eleito && r.mediana_nao_eleito ? r.mediana_eleito / r.mediana_nao_eleito : null
  const b = (t: string) => <b className="tabular font-bold text-tinta">{t}</b>
  return (
    <p className="max-w-[54ch] text-[clamp(1.1rem,0.95rem+0.55vw,1.35rem)] font-medium leading-[1.42] text-tinta-2" style={{ fontStretch: '96%' }}>
      Em {ano}, {b(inteiro(r.candidatos))} candidatos a {cargo.toLowerCase()} {lugar} gastaram {b(reaisCurto(r.gasto_total * fator))}{' '}
      por {b(plural(r.cadeiras, 'cadeira', 'cadeiras'))}. {r.cadeiras === 1 ? 'O eleito' : 'O eleito típico'} gastou {b(reaisCurto((r.mediana_eleito ?? 0) * fator))}
      {r.mediana_nao_eleito ? <>; quem perdeu, {b(reaisCurto(r.mediana_nao_eleito * fator))}{vezes && vezes >= 2 ? `, ${inteiro(Math.round(vezes))} vezes menos` : ''}</> : '; quem perdeu, na maioria, não declarou gasto'}.
      {real != null && (
        <>
          {' '}
          {ano > outro
            ? <>Descontada a inflação, a cadeira ficou {b(`${inteiro(Math.round(Math.abs(real) * 100))}%`)} {real >= 0 ? 'mais cara' : 'mais barata'} que em {outro}.</>
            : <>Em {outro}, descontada a inflação, a mesma cadeira custou {b(`${inteiro(Math.round(Math.abs(1 / (1 + real) - 1) * 100))}%`)} {real <= 0 ? 'mais' : 'menos'}.</>}
        </>
      )}
    </p>
  )
}

export function CadeiraPagina() {
  const busca = useSearch({ from: '/cadeira' })
  const navegar = useNavigate({ from: '/cadeira' })
  const mudar = (s: Partial<BuscaCadeira>) => navegar({ search: (a) => ({ ...a, ...s }), replace: true, resetScroll: false })
  const { data: ufs } = useQuery(consultas.ufs())
  const { data: malha } = useQuery(consultas.malhaBrasil())
  const carregadas = useMemo(() => (ufs ?? []).filter((u) => u.carregada), [ufs])

  const cargo = CARGOS_P1.find((c) => c.cod === busca.cargo) ?? CARGOS_P1[0]
  const anos: Ano[] = cargo.municipal ? [2020, 2024] : [2018, 2022]
  const ano = busca.ano && anos.includes(busca.ano) ? busca.ano : anos[1]
  const vereador = cargo.cod === 13
  const lugares = useMemo(() => semMunicipal(carregadas, cargo.municipal), [carregadas, cargo.municipal])
  // antes da lista de estados chegar vale o endereço (senão a câmara do padrão é pedida à toa e pisca)
  const uf = busca.uf && (ufs ? lugares.some((u) => u.sigla === busca.uf) : !(cargo.municipal && busca.uf === 'DF')) ? busca.uf : ''
  const municipio = vereador ? (busca.municipio ?? CAPITAIS[uf || 'PI']) : undefined
  const q = useQuery({ ...consultas.cadeira(ano, cargo.cod, vereador ? '' : uf, municipio), placeholderData: keepPreviousData })
  const dados = q.data
  const fator = busca.epoca || !dados ? 1 : (dados.ipca[String(dados.ano)] ?? 1)
  const escala = useMemo(() => escalaGasto(dados?.cadeiras.map((a) => a.gasto) ?? []), [dados])
  const [aviso, setAviso] = useState('')
  // o destaque vale só para a seleção em que foi feito (cargo, ano, lugar)
  const [destaque, setDestaque] = useState<{ id: number; chave: string } | null>(null)

  useEffect(() => {
    document.title = 'Quanto custa uma cadeira? · Voto Aberto'
  }, [])

  if (q.error && !dados) return <ErroCarga erro={q.error} />
  if (!dados || !ufs) return <CirandaTela rotulo="Contando as cadeiras..." />

  const ufDados = carregadas.find((u) => u.sigla === dados.escopo.ufs[0])
  const lugarCurto = dados.escopo.municipio
    ? `${dados.escopo.municipio.nome} (${dados.escopo.ufs[0]})`
    : dados.escopo.ufs.length === 1 && ufDados ? ufDados.nome : `${dados.escopo.ufs.length} estados`
  const lugarFrase = dados.escopo.municipio
    ? `em ${dados.escopo.municipio.nome}`
    : dados.escopo.ufs.length === 1 && ufDados ? noEstado(ufDados) : `nos ${dados.escopo.ufs.length} estados com dados`
  const titulo = `${dados.cargo.nome} · ${dados.ano} · ${lugarCurto}`
  const chave = `${dados.ano}-${dados.cargo.cod}-${dados.escopo.ufs.join('')}-${dados.escopo.municipio?.ibge ?? ''}`
  const limiar = entrada(dados.curva)
  const ufEscolhida = vereador ? dados.escopo.ufs[0] : uf
  const abrir = (id: number) => navegar({ to: '/politico/$id', params: { id: String(id) } })

  return (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-12 pt-6 md:px-[var(--casca-margem)] md:pt-7">
      <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1 className="t-display">Quanto custa uma cadeira?</h1>
          <p className="mt-3 max-w-[52ch] text-[1.06rem] text-tinta-2">
            Quanto gastou, em média, a campanha de quem se elegeu. Cada cadeira abaixo é um eleito.
          </p>
        </div>
        <Alternador
          rotulo="Valores"
          valor={busca.epoca ? 'epoca' : 'atual'}
          aoMudar={(v) => mudar({ epoca: v === 'epoca' || undefined })}
          opcoes={[{ valor: 'atual', rotulo: 'Em reais de 2024' }, { valor: 'epoca', rotulo: 'Valores da época' }]}
        />
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
          <legend className="t-rotulo mb-2 text-tinta-2">{vereador ? 'Câmara municipal' : 'Estado'}</legend>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-[300px]">
              <SeletorEstado
                malha={malha}
                ufs={lugares}
                escolhida={ufEscolhida}
                obrigatorio={vereador}
                aoEscolher={(s) => mudar(vereador && s ? { uf: s, municipio: CAPITAIS[s] } : { uf: s })}
              />
            </div>
            {vereador && (
              <div className="flex min-w-[min(100%,340px)] flex-1 flex-wrap items-center gap-3">
                <div className="min-w-[240px] flex-1">
                  <BuscaMunicipio
                    rotulo="Outro município"
                    aoEscolher={(m) => {
                      setAviso(m.carregada ? '' : `${m.nome} (${m.uf}) ainda não foi carregado no banco.`)
                      if (m.carregada) mudar({ uf: m.uf, municipio: m.ibge })
                    }}
                  />
                </div>
                <p className="text-[0.9rem] text-tinta-2" aria-live="polite">
                  {aviso || <>Mostrando <b className="text-tinta">{dados.escopo.municipio?.nome}</b></>}
                </p>
              </div>
            )}
            <div className="flex w-full justify-end sm:ml-auto sm:w-[320px]">
              <BuscaAssento
                key={chave}
                cadeiras={dados.cadeiras}
                achado={destaque?.chave === chave ? destaque.id : null}
                aoAchar={(i) => {
                  setDestaque(i == null ? null : { id: i, chave })
                  if (i != null && busca.pe) mudar({ pe: undefined }) // o destaque é no plano
                }}
              />
            </div>
          </div>
        </fieldset>
      </div>

      <section aria-label="Plenário" className="mt-6" aria-busy={q.isPlaceholderData}>
        {q.error && (
          <p role="alert" className="mx-auto mb-4 max-w-[var(--miolo-max)] rounded-xl border border-corrige/40 bg-folha px-4 py-3 text-[0.9rem]">
            Não foi possível abrir esta seleção ({q.error.message}). O plenário abaixo é o da seleção anterior.
          </p>
        )}
        {dados.cadeiras.length === 0 && (
          <p className="mx-auto max-w-[var(--miolo-max)] text-tinta-2">Nenhum eleito com prestação de contas nesta seleção.</p>
        )}
        <div className={`relative mx-auto max-w-[min(var(--miolo-max),calc((100dvh-120px)*1.92))] transition-opacity duration-300 ${q.isPlaceholderData ? 'opacity-55' : ''}`}>
          {busca.pe ? (
            <div className="relative aspect-[16/10] overflow-hidden rounded-[20px] bg-[radial-gradient(ellipse_70%_55%_at_50%_92%,#fff6d6_0%,transparent_70%),linear-gradient(180deg,#e4edf3_0%,#f1f5f6_48%,#f6f8ef_100%)] sm:aspect-[16/8.5]">
              <Suspense fallback={<div className="grid h-full place-items-center"><Ciranda rotulo="Levantando as cadeiras..." /></div>}>
                <Plenario3D chave={chave} cadeiras={dados.cadeiras} escala={escala} fator={fator} ordem={busca.ordem ?? 'gasto'} aoAbrir={abrir} />
              </Suspense>
              <div className="pointer-events-none absolute inset-x-0 bottom-4 text-center">
                <p className="t-numero text-[clamp(1.8rem,1.2rem+2.4vw,3.4rem)] leading-none">{reaisCurto((dados.resumo.custo_cadeira ?? 0) * fator)}</p>
                <p className="mt-1 text-[0.85rem] font-semibold text-tinta-2">gasto médio de cada {dados.cargo.nome.toLowerCase()} eleito</p>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0"><Fita altura={7} /></div>
            </div>
          ) : (
            <Plenario
              chave={chave}
              cadeiras={dados.cadeiras}
              escala={escala}
              fator={fator}
              ordem={busca.ordem ?? 'gasto'}
              custo={dados.resumo.custo_cadeira}
              legenda={`gasto médio de cada ${dados.cargo.nome.toLowerCase()} eleito`}
              aoAbrir={abrir}
              destaque={destaque?.chave === chave ? destaque.id : null}
            />
          )}
          {q.isPlaceholderData && <div className="absolute right-2 top-2"><Ciranda rotulo="Contando..." tamanho={56} /></div>}
        </div>

        <div className="mx-auto mt-6 flex max-w-[var(--miolo-max)] flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-tinta-2">
            <span className="font-semibold text-tinta">Gasto da campanha do eleito</span>
            <span className="inline-flex items-center gap-2">
              <span className="tabular">{reaisCurto(escala.min * fator)}</span>
              <span
                aria-hidden
                className="h-2.5 w-36 rounded-full"
                style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => corRampa(t)).join(', ')})` }}
              />
              <span className="tabular">{reaisCurto(escala.max * fator)}</span>
            </span>
            {escala.log && <span className="text-tinta-3">escala logarítmica</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Alternador
              rotulo="Ordem das cadeiras"
              valor={busca.ordem ?? 'gasto'}
              aoMudar={(v) => mudar({ ordem: v === 'partido' ? 'partido' : undefined })}
              opcoes={[{ valor: 'gasto', rotulo: 'Por gasto' }, { valor: 'partido', rotulo: 'Por partido' }]}
            />
            <Alternador
              rotulo="Vista"
              valor={busca.pe ? 'pe' : 'plano'}
              aoMudar={(v) => mudar({ pe: v === 'pe' || undefined })}
              opcoes={[
                { valor: 'plano', rotulo: 'Plano', icone: <Square size={14} weight="bold" aria-hidden /> },
                { valor: 'pe', rotulo: 'Em pé', icone: <Cube size={14} weight="bold" aria-hidden /> },
              ]}
            />
          </div>
        </div>
        {busca.ordem === 'partido' && (
          <p className="mx-auto mt-3 max-w-[var(--miolo-max)] text-[0.8rem] text-tinta-3">
            Partidos da esquerda para a direita pela escala de viés da P7; a cor continua sendo o gasto.
          </p>
        )}

        <div className="mx-auto mt-8 max-w-[var(--miolo-max)]">
          <Lede dados={dados} ano={dados.ano} outro={anos.find((a) => a !== dados.ano)!} cargo={dados.cargo.nome} lugar={lugarFrase} />
          <p className="mt-4 text-[0.8rem] text-tinta-3">
            {busca.epoca ? 'Valores da época.' : 'Valores em reais de outubro de 2024, corrigidos pelo IPCA.'} Passe o mouse ou toque numa cadeira para ver quem é; clique para abrir a carreira.
          </p>
        </div>
      </section>

      <section aria-labelledby="curva" className="adiar mx-auto mt-16 grid max-w-[var(--miolo-max)] grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,2fr)] lg:items-end">
        <div>
          <h2 id="curva" className="t-h2">A partir de quanto se ganha?</h2>
          <p className="mt-3 text-tinta-2">
            Candidatos agrupados pelo que gastaram. A barra é a parte de cada grupo que se elegeu{dados.escopo.municipio && ufDados ? `, contando todos os candidatos a vereador ${noEstado(ufDados)}` : ''}.
          </p>
          {limiar ? (
            <p className="mt-6">
              <span className="t-numero block text-[clamp(2.2rem,1.5rem+2vw,3.1rem)] leading-none">{reaisCurto(limiar.de * fator)}</span>
              <span className="mt-2 block text-tinta-2">é o preço de entrada: a partir daí, metade ou mais dos candidatos se elege.</span>
            </p>
          ) : (
            <p className="mt-6 text-tinta-2">Em nenhuma faixa de gasto a maioria dos candidatos se elegeu.</p>
          )}
        </div>
        <CurvaVitoria curva={dados.curva} escala={escala} fator={fator} />
      </section>

      <section aria-labelledby="partidos" className="adiar mx-auto mt-16 max-w-[var(--miolo-max)]">
        <h2 id="partidos" className="t-h2">Quanto cada partido pagou por cadeira</h2>
        <p className="mb-6 mt-3 max-w-[64ch] text-tinta-2">
          Tudo o que os candidatos do partido gastaram, dividido pelas cadeiras que ele levou. A cor é a posição do partido na escala de viés.
        </p>
        <PrecoPartidos partidos={dados.partidos} fator={fator} />
      </section>

      <section aria-labelledby="dinheiro" className="adiar mx-auto mt-16 max-w-[var(--miolo-max)]">
        <h2 id="dinheiro" className="t-h2">Para onde vai e de onde vem o dinheiro</h2>
        <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">
          <Recibo dados={dados} fator={fator} titulo={titulo} />
          <Fontes dados={dados} fator={fator} />
        </div>
      </section>

      <section aria-labelledby="voto" className="adiar mx-auto mt-16 max-w-[var(--miolo-max)]">
        <h2 id="voto" className="t-h2">Quanto custou cada voto</h2>
        <div className="mt-4">
          <CustoVoto cadeiras={dados.cadeiras} fator={fator} />
        </div>
      </section>
    </div>
  )
}
