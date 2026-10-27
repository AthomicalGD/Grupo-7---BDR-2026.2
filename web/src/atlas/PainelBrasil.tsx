import { ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import { geoConicEqualArea, geoPath } from 'd3-geo'
import { useMemo } from 'react'
import type { Ano, Malha, MunicipioBusca, UF } from '../api'
import { decimal, vies as fmtVies } from '../lib/formato'
import { corVies } from '../lib/vies'
import { SATURA_UF } from './valores'
import { BuscaMunicipio } from './BuscaMunicipio'
import { silhueta } from './geo'

interface Props {
  ufs: UF[]
  malha: Malha
  ano: Ano
  /** anos com dado no filtro: um mapinho para cada */
  anos: readonly Ano[]
  aoMudarAno: (a: Ano) => void
  /** nome do cargo do filtro (#10), se houver */
  cargo?: string
  aoEscolherUF: (sigla: string) => void
  aoApontarUF?: (sigla: string) => void
  aoEscolherMunicipio: (m: MunicipioBusca) => void
}

const ORDEM_REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']

export function PainelBrasil({ ufs, malha, ano, anos, aoMudarAno, cargo, aoEscolherUF, aoApontarUF, aoEscolherMunicipio }: Props) {
  const silhuetas = useMemo(() => new Map(ufs.map((u) => [u.sigla, silhueta(malha, u.cd_ibge, 40)])), [ufs, malha])
  const carregadas = ufs.filter((u) => u.carregada).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const faltam = ufs.filter((u) => !u.carregada)
  const comValor = carregadas.filter((u) => u.vies[ano] != null)
  const maisEsq = comValor.length ? comValor.reduce((a, b) => (a.vies[ano]! <= b.vies[ano]! ? a : b)) : undefined
  const maisDir = comValor.length ? comValor.reduce((a, b) => (a.vies[ano]! >= b.vies[ano]! ? a : b)) : undefined

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <h1 className="t-display">Para onde o voto pendeu</h1>
        <p className="max-w-[54ch] text-[1.05rem] leading-relaxed text-tinta-2">
          Viés partidário de cada estado e município de 2018 a 2026, de −100 (esquerda) a +100 (direita), calculado
          {cargo ? <> só com os votos válidos para <b className="font-semibold text-tinta">{cargo.toLowerCase()}</b>.</> : ' com os votos válidos de todos os cargos.'}
        </p>
      </header>

      <BuscaMunicipio aoEscolher={aoEscolherMunicipio} />

      <Mapinhos ufs={ufs} malha={malha} ano={ano} anos={anos} aoMudarAno={aoMudarAno} />

      <section aria-labelledby="estados-com-dados" className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="estados-com-dados" className="t-h3">Estados com dados</h2>
          <span className="text-[0.82rem] text-tinta-3 tabular">viés em {ano}{anos.includes((ano - 4) as Ano) ? ` · seta: mudança desde ${ano - 4}` : ''}</span>
        </div>
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {carregadas.map((u) => {
            const v = u.vies[ano]
            // a seta compara com a eleição do mesmo tipo anterior (geral com geral, municipal com municipal)
            const antes = u.vies[(ano - 4) as Ano]
            const delta = v != null && antes != null ? v - antes : null
            return (
              <li key={u.sigla}>
                <button
                  type="button"
                  onClick={() => aoEscolherUF(u.sigla)}
                  onPointerEnter={() => aoApontarUF?.(u.sigla)}
                  onFocus={() => aoApontarUF?.(u.sigla)}
                  className="group flex w-full items-center gap-2.5 rounded-2xl border border-linha bg-folha px-3 py-2.5 text-left transition-[border-color,transform,box-shadow] hover:border-tinta hover:shadow-[var(--shadow-cartao)] active:scale-[0.99]"
                >
                  <svg viewBox="0 0 40 40" className="size-9 shrink-0 overflow-visible" aria-hidden>
                    <path d={silhuetas.get(u.sigla)} fill={corVies(v, SATURA_UF)} stroke="var(--color-tinta)" strokeWidth={0.9} strokeLinejoin="round" className="mapa-forma" />
                  </svg>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{u.nome}</span>
                    <span className="t-mono block text-[0.75rem] text-tinta-3">{u.sigla}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="t-numero block text-[1.3rem] leading-none tabular">{fmtVies(v)}</span>
                    {delta != null && Math.abs(delta) >= 0.5 && (
                      <span
                        className="mt-1 inline-flex items-center gap-0.5 text-[0.78rem] font-semibold tabular"
                        style={{ color: corVies(delta > 0 ? SATURA_UF : -SATURA_UF, SATURA_UF) }}
                        title={`${delta > 0 ? 'Mais à direita' : 'Mais à esquerda'} que em ${ano - 4}`}
                      >
                        {delta > 0 ? <ArrowRight size={11} weight="bold" aria-hidden /> : <ArrowLeft size={11} weight="bold" aria-hidden />}
                        {decimal(Math.abs(delta), 1)}
                        <span className="sr-only"> {delta > 0 ? 'para a direita' : 'para a esquerda'} desde {ano - 4}</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {maisEsq && maisDir && maisEsq !== maisDir && (
          <p className="text-[0.9rem] text-tinta-2">
            Em {ano}, entre os estados carregados, <b className="text-tinta">{maisEsq.nome}</b> foi o mais à esquerda (
            <span className="tabular">{fmtVies(maisEsq.vies[ano])}</span>) e <b className="text-tinta">{maisDir.nome}</b> o mais à
            direita (<span className="tabular">{fmtVies(maisDir.vies[ano])}</span>).
          </p>
        )}
      </section>

      <section aria-labelledby="sem-dados" className="space-y-3 border-t border-linha pt-6">
        <h2 id="sem-dados" className="t-rotulo text-tinta-2">
          {faltam.length} estados sem dados carregados
        </h2>
        <ul className="flex flex-wrap gap-1.5">
          {[...faltam]
            .sort((a, b) => ORDEM_REGIOES.indexOf(a.regiao) - ORDEM_REGIOES.indexOf(b.regiao) || a.nome.localeCompare(b.nome))
            .map((u) => (
              <li key={u.sigla} title={u.nome} className="flex items-center gap-1 rounded-lg bg-papel-2/70 py-1 pl-1 pr-2">
                <svg viewBox="0 0 40 40" className="size-6" aria-hidden>
                  <path d={silhuetas.get(u.sigla)} fill="#eceef0" stroke="var(--color-linha-2)" strokeWidth={1.2} />
                </svg>
                <span className="t-mono text-[0.78rem] text-tinta-3">{u.sigla}</span>
              </li>
            ))}
        </ul>
        <p className="text-[0.82rem] text-tinta-3">
          Para carregar: <code className="t-mono rounded bg-papel-2 px-1.5 py-0.5 text-tinta-2">python -m loader SP MG</code>
        </p>
      </section>
    </div>
  )
}

const LADO_MAPINHO = 112

/** Os anos lado a lado, um Brasil pequeno para cada (small multiples): a mudança aparece sem animar. Tocar troca o ano do mapa. */
function Mapinhos({ ufs, malha, ano, anos, aoMudarAno }: { ufs: UF[]; malha: Malha; ano: Ano; anos: readonly Ano[]; aoMudarAno: (a: Ano) => void }) {
  const estados = useMemo(() => {
    const caminho = geoPath(geoConicEqualArea().parallels([-2, -22]).rotate([54, 0]).preclip((s) => s).precision(0).fitSize([LADO_MAPINHO, LADO_MAPINHO], malha)).digits(1)
    const porCodigo = new Map(ufs.map((u) => [u.cd_ibge, u]))
    return malha.features.map((f) => ({ d: caminho(f) ?? '', uf: porCodigo.get(f.properties.codarea) }))
  }, [malha, ufs])
  if (anos.length < 2) return null
  return (
    <section aria-labelledby="mapinhos" className="space-y-2.5">
      <h2 id="mapinhos" className="t-h3">Os {anos.length} anos lado a lado</h2>
      <ul className="grid gap-2" style={{ gridTemplateColumns: `repeat(${anos.length}, minmax(0, 1fr))` }}>
        {anos.map((a) => (
          <li key={a}>
            <button
              type="button"
              onClick={() => aoMudarAno(a)}
              aria-pressed={a === ano}
              aria-label={`Ver ${a} no mapa`}
              className={`w-full rounded-xl border px-1.5 pb-1.5 pt-2 transition-colors ${a === ano ? 'border-tinta bg-folha' : 'border-transparent hover:border-linha-2 hover:bg-folha'}`}
            >
              <svg viewBox={`0 0 ${LADO_MAPINHO} ${LADO_MAPINHO}`} className="mx-auto block w-full max-w-[112px]" aria-hidden>
                {estados.map(({ d, uf }, i) => (
                  <path key={i} d={d} fill={uf?.carregada ? corVies(uf.vies[a], SATURA_UF) : '#eceef0'} stroke="#fcfdfd" strokeWidth={0.5} />
                ))}
              </svg>
              <span className={`mt-1 block text-center text-[0.86rem] tabular ${a === ano ? 'font-bold text-tinta' : 'font-semibold text-tinta-2'}`}>{a}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
