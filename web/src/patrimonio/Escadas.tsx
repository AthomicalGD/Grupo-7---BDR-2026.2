// "Vale para todos os cargos?": cada disputa (cargo e ano) é uma escadinha de quatro degraus, a taxa de
// eleição das quatro faixas de patrimônio, da que declarou menos à que declarou mais, todas na mesma régua.
// Quando o último degrau não passa do primeiro, a escadinha leva o aviso "não sobe". Tocar abre o cofrinho.
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
            background: claro ? '#d2e19a' : COR.eleito,
            boxShadow: claro ? undefined : `inset 0 -1px 0 ${COR.eleitoBorda}`,
          }}
        />
      ))}
    </span>
  )
}

function Celula({ r, teto, ativa, aoAbrir }: { r: Recorte; teto: number; ativa: boolean; aoAbrir: () => void }) {
  const qs = quartis(r.grupos)
  const [q1, q4] = [qs[0], qs.at(-1)]
  const sobe = r.sintese.maior_supera_menor
  return (
    <button
      type="button"
      onClick={aoAbrir}
      aria-pressed={ativa}
      aria-label={`${r.cargo.nome}, ${r.ano}: dos 25% com menos bens, ${q1 ? taxaCurta(q1.taxa) : '-'} se elegeram; dos 25% com mais bens, ${q4 ? taxaCurta(q4.taxa) : '-'}. Abrir no cofrinho.`}
      className={`group flex min-w-0 flex-col justify-between gap-2 rounded-xl border px-3 pb-2.5 pt-3 text-left transition-[border-color,background-color,transform] active:scale-[0.98] ${
        ativa ? 'border-selecao bg-selecao-claro shadow-[inset_0_-3px_0_var(--color-selecao)]' : 'border-linha bg-folha hover:border-linha-2'
      }`}
    >
      <span className="flex items-end justify-between gap-2">
        <Degraus r={r} teto={teto} animar />
        {!sobe && <span className="rounded-full bg-papel-2 px-2 py-0.5 text-[0.75rem] font-bold text-tinta-2">não sobe</span>}
      </span>
      <span className="tabular text-[0.8rem] leading-tight text-tinta-2">
        <b className="font-bold text-tinta">{q1 ? taxaCurta(q1.taxa) : '-'}</b> → <b className="font-bold" style={{ color: COR.texto }}>{q4 ? taxaCurta(q4.taxa) : '-'}</b>
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
  return (
    <div className="min-w-0">
      <h3 className="t-h3">{titulo}</h3>
      <div className="mt-3 grid grid-cols-[minmax(6.5rem,8.5rem)_repeat(2,minmax(0,8.5rem))] items-stretch gap-2">
        <span />
        {anos.map((a) => <span key={a} className="t-numero tabular text-[1.35rem] text-tinta-2">{a}</span>)}
        {linhas.map((c) => {
          const nome = recortes.find((r) => r.cargo.cod === c)!.cargo.nome
          return (
            <div key={c} className="contents">
              <span className="self-center text-[0.86rem] font-semibold leading-tight text-tinta">{nome}</span>
              {anos.map((a) => {
                const r = achar(a, c)
                return r ? (
                  <Celula key={a} r={r} teto={teto} ativa={ativo.ano === a && ativo.cargo === c} aoAbrir={() => aoAbrir(a, c)} />
                ) : (
                  <span key={a} className="grid place-items-center rounded-xl border border-dashed border-linha-2 text-[0.75rem] text-tinta-3">sem dados</span>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const Escadas = memo(function Escadas({ panorama, ativo, aoAbrir }: { panorama: PanoramaPatrimonio; ativo: { ano: number; cargo: number }; aoAbrir: (ano: number, cargo: number) => void }) {
  const teto = tetoDe(panorama.recortes)
  const excecoes = panorama.recortes.filter((r) => r.sintese.quartis === 4 && !r.sintese.maior_supera_menor)
  return (
    <div>
      <div className="grid gap-x-12 gap-y-8 md:grid-cols-[auto_auto] md:justify-start">
        <Bloco titulo="Eleições gerais" cargos={GERAIS} anos={[2018, 2022]} recortes={panorama.recortes} teto={teto} ativo={ativo} aoAbrir={aoAbrir} />
        <div className="flex flex-col gap-8">
          <Bloco titulo="Eleições municipais" cargos={MUNICIPAIS} anos={[2020, 2024]} recortes={panorama.recortes} teto={teto} ativo={ativo} aoAbrir={aoAbrir} />
          <div className="max-w-[34ch] text-[0.86rem] leading-relaxed text-tinta-2">
            <p className="flex items-center gap-2 font-semibold text-tinta">
              <Degraus r={panorama.recortes.find((r) => r.sintese.maior_supera_menor) ?? panorama.recortes[0]} teto={teto} altura={22} largura={7} />
              menos bens → mais bens
            </p>
            {excecoes.length > 0 && (
              <p className="mt-2">
                {excecoes.map((r) => `${r.cargo.nome} em ${r.ano}`).join(' e ')}{' '}
                {excecoes.length === 1 ? 'é a exceção' : 'são as exceções'}: com poucos candidatos, um só eleito decide o degrau.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
