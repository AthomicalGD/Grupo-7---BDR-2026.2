// O recorte da P2 numa frase: "Candidatos a [vereador] em [2024], [nos 6 estados]". Cada palavra destacada é
// um botão que abre uma gaveta logo abaixo com as opções: os cargos (com a escadinha de cada um), os anos e o
// minimapa dos estados. A frase é o subtítulo e o filtro ao mesmo tempo: nada de controles soltos em volta
// do cofrinho. A gaveta fecha com Esc, com um clique fora ou ao escolher.
import { CaretDown } from '@phosphor-icons/react'
import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { CARGOS_P2, type Ano, type Malha, type PanoramaPatrimonio, type UF } from '../api'
import { quartis, taxaCurta, tetoDe } from './conta'
import { Degraus } from './Escadas'
import { MapaEstados } from './MapaEstados'

type Gaveta = 'cargo' | 'ano' | 'estado' | null

function Palavra({ aberta, aoAbrir, children, rotulo }: { aberta: boolean; aoAbrir: () => void; children: ReactNode; rotulo: string }) {
  return (
    <button
      type="button"
      aria-expanded={aberta}
      aria-label={rotulo}
      onClick={aoAbrir}
      className={`recorte-palavra inline-flex items-baseline gap-1 rounded-md px-1 font-bold text-tinta ${aberta ? 'bg-selecao-claro' : ''}`}
    >
      <span>{children}</span>
      <CaretDown size={16} weight="bold" aria-hidden className={`translate-y-[1px] self-center text-selecao transition-transform duration-200 ${aberta ? 'rotate-180' : ''}`} />
    </button>
  )
}

export const Recorte = memo(function Recorte({ cargo, ano, anos, uf, ufs, malha, panorama, aoCargo, aoAno, aoUf }: {
  cargo: (typeof CARGOS_P2)[number]
  ano: Ano
  anos: Ano[]
  uf: string
  ufs: UF[]
  malha: Malha | undefined
  panorama: PanoramaPatrimonio | undefined
  aoCargo: (cod: number) => void
  aoAno: (a: Ano) => void
  aoUf: (sigla: string | undefined) => void
}) {
  const [gaveta, setGaveta] = useState<Gaveta>(null)
  const raiz = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!gaveta) return
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setGaveta(null)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setGaveta(null)
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [gaveta])
  const alternar = (g: Gaveta) => setGaveta((atual) => (atual === g ? null : g))
  const ufNome = ufs.find((u) => u.sigla === uf)?.nome
  const onde = cargo.nacional ? 'no Brasil inteiro' : ufNome ? `em ${ufNome}` : `nos ${ufs.length} estados`
  const teto = panorama ? tetoDe(panorama.recortes) : 50

  return (
    <div ref={raiz} className="relative">
      <p className="text-[clamp(1.2rem,1rem+0.7vw,1.6rem)] font-medium leading-[1.5] text-tinta-2" style={{ fontStretch: '96%' }}>
        Candidatos a{' '}
        <Palavra aberta={gaveta === 'cargo'} aoAbrir={() => alternar('cargo')} rotulo={`Cargo: ${cargo.nome}. Trocar`}>{cargo.nome.toLowerCase()}</Palavra>
        {' '}em{' '}
        <Palavra aberta={gaveta === 'ano'} aoAbrir={() => alternar('ano')} rotulo={`Eleição: ${ano}. Trocar`}>{ano}</Palavra>
        ,{' '}
        {cargo.nacional ? (
          <span className="font-bold text-tinta">{onde}</span>
        ) : (
          <Palavra aberta={gaveta === 'estado'} aoAbrir={() => alternar('estado')} rotulo={`Estado: ${ufNome ?? 'todos'}. Trocar`}>{onde}</Palavra>
        )}
      </p>

      {gaveta && (
        <div role="dialog" aria-label={gaveta === 'cargo' ? 'Escolher o cargo' : gaveta === 'ano' ? 'Escolher a eleição' : 'Escolher o estado'} className={`gaveta absolute left-0 top-full z-20 mt-2 rounded-[20px] border border-linha bg-folha p-4 shadow-[var(--shadow-papel)] sm:p-5 ${gaveta === 'cargo' ? 'w-[min(100%,740px)]' : 'w-max max-w-full'}`}>
          {gaveta === 'cargo' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { titulo: 'Eleições gerais', cargos: CARGOS_P2.filter((c) => !c.municipal) },
                { titulo: 'Municipais', cargos: CARGOS_P2.filter((c) => c.municipal) },
              ].map((grupo) => (
                <div key={grupo.titulo} role="radiogroup" aria-label={grupo.titulo}>
                  <p className="t-rotulo mb-2 text-tinta-3">{grupo.titulo}</p>
                  <div className="grid gap-1">
                    {grupo.cargos.map((c) => {
                      const a = (c.municipal ? [2020, 2024] : [2018, 2022]).includes(ano) ? ano : c.municipal ? 2024 : 2022
                      const r = panorama?.recortes.find((x) => x.ano === a && x.cargo.cod === c.cod)
                      const qs = r ? quartis(r.grupos) : []
                      const marcado = c.cod === cargo.cod
                      return (
                        <button
                          key={c.cod}
                          type="button"
                          role="radio"
                          aria-checked={marcado}
                          aria-label={qs.length ? `${c.nome}: de ${taxaCurta(qs[0].taxa)} na faixa de menos bens a ${taxaCurta(qs.at(-1)!.taxa)} na de mais bens` : c.nome}
                          onClick={() => { aoCargo(c.cod); setGaveta(null) }}
                          className={`flex h-12 items-center justify-between gap-3 rounded-xl px-3 text-left transition-colors ${marcado ? 'selecionado-fita' : 'hover:bg-papel-2'}`}
                        >
                          <span className="font-semibold">{c.nome}</span>
                          <span className="flex items-center gap-2.5">
                            {qs.length > 0 && <span className={`tabular text-[0.78rem] ${marcado ? 'text-white' : 'text-tinta-3'}`}>{taxaCurta(qs[0].taxa)} → {taxaCurta(qs.at(-1)!.taxa)}</span>}
                            {r && <Degraus r={r} teto={teto} altura={22} largura={5} claro={marcado} />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {gaveta === 'ano' && (
            <div role="radiogroup" aria-label="Eleição" className="flex gap-2">
              {anos.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={a === ano}
                  onClick={() => { aoAno(a); setGaveta(null) }}
                  className={`t-numero tabular h-14 flex-1 rounded-xl border text-[1.6rem] transition-colors ${a === ano ? 'selecionado-fita' : 'border-linha hover:border-linha-2'}`}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
          {gaveta === 'estado' && (
            <MapaEstados malha={malha} ufs={ufs} escolhida={uf} aoEscolher={(s) => { aoUf(s); setGaveta(null) }} nacional={false} />
          )}
        </div>
      )}
    </div>
  )
})
