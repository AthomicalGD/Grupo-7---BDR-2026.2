// "Vale para todos os cargos?": cada linha é uma disputa (cargo e ano). Duas peças de azulejo numa régua comum:
// a amarela é a chance de eleição de quem declarou menos bens (os 25% de baixo), a azul é a de quem declarou mais
// (os 25% de cima); o rejunte liga as duas. Peça azul à direita da amarela: declarar mais bens ajudou. Quando não
// passa, o rejunte fica vermelho e a linha leva o aviso "não sobe". Tocar numa linha abre o cofrinho.
// (Os degraus em miniatura abaixo seguem sendo usados nas fichas de cargo.)
import { memo } from 'react'
import type { PanoramaPatrimonio } from '../api'
import { COR, quartis, taxaCurta, tetoDe } from './conta'

type Recorte = PanoramaPatrimonio['recortes'][number]

const GERAIS = [1, 3, 5, 6, 7]
const MUNICIPAIS = [11, 13]

/** Os quatro degraus em miniatura (usado também nas fichas de cargo). */
export function Degraus({ r, teto, altura = 40, largura = 11, claro = false, animar = false }: { r: Recorte; teto: number; altura?: number; largura?: number; claro?: boolean; animar?: boolean }) {
  const qs = quartis(r.grupos)
  return (
    <span aria-hidden className="flex items-end gap-[3px]" style={{ height: altura }}>
      {qs.map((g) => (
        <span
          key={g.id}
          className={`${animar ? 'degrau ' : ''}rounded-t-[3px]`}
          style={{
            width: largura,
            height: Math.max(2, (altura * g.taxa) / teto),
            background: claro ? '#86a6dc' : COR.eleito,
            boxShadow: claro ? undefined : `inset 0 -1px 0 ${COR.eleitoBorda}`,
          }}
        />
      ))}
    </span>
  )
}

/** Os dois degraus que contam (os 25% com menos e com mais bens) e a régua: o teto vira múltiplo de 10 e sai um fio a cada 10%. */
function regua(teto: number) {
  const max = Math.max(10, Math.ceil(teto / 10) * 10)
  return { max, fios: Array.from({ length: max / 10 + 1 }, (_, i) => i * 10) }
}

/** Uma peça de azulejo: quadrado com rejunte de tinta; a cor diz de quem é (amarela: menos bens, azul: mais bens). */
function Peca({ x, cor, topo = false }: { x: number; cor: string; topo?: boolean }) {
  return (
    <span
      aria-hidden
      className="absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-[4px] border-[2.5px] border-tinta"
      style={{ left: `${x}%`, background: cor, zIndex: topo ? 2 : 1 }}
    />
  )
}

function Linha({ r, max, fios, ativa, aoAbrir }: { r: Recorte; max: number; fios: number[]; ativa: boolean; aoAbrir: () => void }) {
  const qs = quartis(r.grupos)
  const [q1, q4] = [qs[0], qs.at(-1)]
  const sobe = r.sintese.maior_supera_menor
  const [x1, x4] = [q1 ? (q1.taxa / max) * 100 : 0, q4 ? (q4.taxa / max) * 100 : 0]
  return (
    <button
      type="button"
      onClick={aoAbrir}
      aria-pressed={ativa}
      aria-label={`${r.cargo.nome}, ${r.ano}: dos 25% com menos bens, ${q1 ? taxaCurta(q1.taxa) : '-'} se elegeram; dos 25% com mais bens, ${q4 ? taxaCurta(q4.taxa) : '-'}. Abrir no cofrinho.`}
      className={`grid w-full grid-cols-[3.4rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 rounded-[var(--canto)] border-[3px] px-2.5 py-1.5 text-left transition-[border-color,background-color,transform] active:scale-[0.99] md:grid-cols-[3.4rem_minmax(0,1fr)_8.6rem] ${
        ativa ? 'border-tinta bg-selecao-claro' : 'border-transparent hover:border-linha-2'
      }`}
    >
      <span className="t-numero tabular text-[1.15rem] text-tinta">{r.ano}</span>
      <span className="relative block h-9" aria-hidden>
        {fios.map((f) => (
          <span key={f} className="absolute inset-y-0 w-px bg-linha" style={{ left: `${(f / max) * 100}%` }} />
        ))}
        <span
          className="absolute top-1/2 h-[3px] -translate-y-1/2"
          style={{ left: `${Math.min(x1, x4)}%`, width: `${Math.abs(x4 - x1)}%`, minWidth: sobe ? undefined : 8, background: sobe ? 'var(--color-tinta)' : 'var(--vermelho)' }}
        />
        <Peca x={x1} cor="var(--amarelo)" />
        <Peca x={x4} cor="var(--azul)" topo />
      </span>
      <span className="tabular col-start-2 flex items-baseline gap-x-2 text-[0.84rem] leading-tight text-tinta-2 md:col-start-3">
        <span><b className="font-bold text-tinta">{q1 ? taxaCurta(q1.taxa) : '-'}</b> → <b className="font-bold text-selecao-tinta">{q4 ? taxaCurta(q4.taxa) : '-'}</b></span>
        {!sobe && <span className="rounded-full border-2 px-1.5 text-[0.72rem] font-bold text-tinta" style={{ borderColor: 'var(--vermelho)' }}>não sobe</span>}
      </span>
    </button>
  )
}

function Bloco({ titulo, cargos, anos, recortes, teto, ativo, aoAbrir }: {
  titulo: string
  cargos: number[]
  anos: number[]
  recortes: Recorte[]
  teto: number
  ativo: { ano: number; cargo: number }
  aoAbrir: (ano: number, cargo: number) => void
}) {
  const achar = (ano: number, cargo: number) => recortes.find((r) => r.ano === ano && r.cargo.cod === cargo)
  const linhas = cargos.filter((c) => anos.some((a) => achar(a, c)))
  if (!linhas.length) return null
  const { max, fios } = regua(teto)
  return (
    <div className="min-w-0">
      <h3 className="t-h3">{titulo}</h3>
      {/* a régua usa o mesmo desenho das linhas (ano, régua, números), para os fios caírem em cima dos fios */}
      <div className="mt-3 grid grid-cols-[3.4rem_minmax(0,1fr)] gap-x-3 px-2.5 md:grid-cols-[3.4rem_minmax(0,1fr)_8.6rem]" aria-hidden>
        <span />
        <span className="relative block h-5">
          {fios.map((f) => (
            <span key={f} className={`tabular absolute text-[0.74rem] font-semibold text-tinta-3 ${f === max ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: `${(f / max) * 100}%` }}>{f}%</span>
          ))}
        </span>
      </div>
      <div className="mt-1 space-y-5">
        {linhas.map((c) => {
          const nome = recortes.find((r) => r.cargo.cod === c)!.cargo.nome
          return (
            <section key={c} aria-label={nome}>
              <h4 className="px-2.5 text-[0.95rem] font-bold text-tinta">{nome}</h4>
              <div className="mt-0.5">
                {anos.map((a) => {
                  const r = achar(a, c)
                  return r ? <Linha key={a} r={r} max={max} fios={fios} ativa={ativo.ano === a && ativo.cargo === c} aoAbrir={() => aoAbrir(a, c)} /> : null
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

const PECA_LEGENDA = 'size-[18px] shrink-0 rounded-[4px] border-[2.5px] border-tinta'

export const Escadas = memo(function Escadas({ panorama, ativo, aoAbrir }: { panorama: PanoramaPatrimonio; ativo: { ano: number; cargo: number }; aoAbrir: (ano: number, cargo: number) => void }) {
  const teto = tetoDe(panorama.recortes)
  const excecoes = panorama.recortes.filter((r) => r.sintese.quartis === 4 && !r.sintese.maior_supera_menor)
  // um exemplo lido em voz alta, com os números de uma disputa de verdade (governador de 2022 ou a primeira que sobe)
  const exemplo = panorama.recortes.find((r) => r.cargo.cod === 3 && r.ano === 2022) ?? panorama.recortes.find((r) => r.sintese.maior_supera_menor)
  const [e1, e4] = exemplo ? [quartis(exemplo.grupos)[0], quartis(exemplo.grupos).at(-1)] : []
  return (
    <div>
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.9rem] font-semibold text-tinta" aria-label="Como ler">
        <li className="flex items-center gap-2"><span aria-hidden className={PECA_LEGENDA} style={{ background: 'var(--amarelo)' }} />Quem declarou menos bens (os 25% de baixo)</li>
        <li className="flex items-center gap-2"><span aria-hidden className={PECA_LEGENDA} style={{ background: 'var(--azul)' }} />Quem declarou mais (os 25% de cima)</li>
        <li className="flex items-center gap-2"><span aria-hidden className="h-[3px] w-6 shrink-0" style={{ background: 'var(--vermelho)' }} />Não sobe: declarar mais não ajudou</li>
      </ul>
      <div className="mt-8 grid gap-x-14 gap-y-12 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Bloco titulo="Eleições gerais" cargos={GERAIS} anos={[2018, 2022, 2026]} recortes={panorama.recortes} teto={teto} ativo={ativo} aoAbrir={aoAbrir} />
        <div className="flex flex-col gap-10">
          <Bloco titulo="Eleições municipais" cargos={MUNICIPAIS} anos={[2020, 2024]} recortes={panorama.recortes} teto={teto} ativo={ativo} aoAbrir={aoAbrir} />
          {exemplo && e1 && e4 && (
            <p className="max-w-[40ch] rounded-[var(--canto)] border-[3px] border-tinta px-4 py-3 text-[0.92rem] leading-relaxed text-tinta">
              <b>Lendo uma linha.</b> Em {exemplo.cargo.nome}, {exemplo.ano}, {taxaCurta(e1.taxa)} de quem declarou menos bens se elegeu. Entre quem declarou mais, foram {taxaCurta(e4.taxa)}.
            </p>
          )}
          {excecoes.length > 0 && (
            <p className="max-w-[40ch] px-2.5 text-[0.9rem] leading-relaxed text-tinta-2">
              {excecoes.map((r) => `${r.cargo.nome} em ${r.ano}`).join(' e ')}{' '}
              {excecoes.length === 1 ? 'é a exceção' : 'são as exceções'}: com poucos candidatos, um só eleito decide o resultado.
            </p>
          )}
        </div>
      </div>
    </div>
  )
})
