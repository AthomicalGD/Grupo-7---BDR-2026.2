// Santinho de cada eleição, como o impresso de campanha: na frente, as cores do Brasil (a família de
// cor vem do cargo e o viés do partido puxa um pouco o tom) com a retícula da gráfica, o ano em pé
// numa faixa, a foto inteira sangrando no topo e na direita, as sete fitas da marca cruzando como a
// faixa dos santinhos, o nome de urna, o cargo, o partido com a bolinha do viés, o número em casas
// como no visor da urna e a letra miúda no rodapé; o carimbo do resultado por cima. Clicando, ele vira: o verso é a "cola" que o eleitor leva
// para a urna, com os dados daquela eleição. É uma reconstrução com dados do TSE, não material de
// campanha (a frente e o verso dizem isso).
import { ArrowCounterClockwise, ArrowRight } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { Candidatura } from '../api'
import { Retrato } from '../componentes/Retrato'
import { situacao } from '../lib/carreira'
import { cargo as fmtCargo, inteiro, nomeProprio, reaisCurto, vies as fmtVies } from '../lib/formato'
import { corVies } from '../lib/vies'

const FITAS = ['#5E881B', '#A2BD31', '#5D6B94', '#468BAF', '#76ACD0', '#F19929', '#FBC700']

/** Família de cor de cada cargo (código do TSE), nas cores do Brasil, em oklch: luz, croma, matiz. */
const COR_CARGO: Record<number, readonly [number, number, number]> = {
  1: [0.42, 0.13, 262], // Presidência: azul-anil
  2: [0.42, 0.13, 262],
  3: [0.5, 0.14, 152], // Governo: verde-bandeira
  4: [0.5, 0.14, 152],
  5: [0.5, 0.12, 240], // Senado: azul
  9: [0.5, 0.12, 240],
  10: [0.5, 0.12, 240],
  6: [0.45, 0.11, 165], // Câmara dos Deputados: verde-mata
  7: [0.58, 0.15, 134], // Assembleia: verde-folha
  8: [0.58, 0.15, 134],
  11: [0.85, 0.16, 90], // Prefeitura: amarelo-ouro
  12: [0.85, 0.16, 90],
  13: [0.8, 0.16, 72], // Câmara Municipal: amarelo-sol
}

/** O viés puxa o matiz até 15°: esquerda para o lado quente, direita para o frio. */
function corDoSantinho(codCargo: number, vies: number | null) {
  const [l, c, h] = COR_CARGO[codCargo] ?? COR_CARGO[3]
  const m = h + (vies ?? 0) * 0.15
  return {
    fundo: `linear-gradient(168deg, oklch(${l + 0.06} ${c} ${m - 8}), oklch(${l - 0.07} ${c} ${m + 8}))`,
    tinta: l > 0.7 ? 'var(--color-tinta)' : 'var(--color-folha)',
  }
}

/** As sete fitas em onda, subindo da esquerda para a direita: a faixa que cruza o santinho. */
const ONDAS = FITAS.map((_, i) => {
  const pontos: string[] = []
  for (let x = -6; x <= 242; x += 6) {
    const y = 6 + i * 5.5 + 22 * (1 - x / 236) + Math.sin((x / 170) * 2 * Math.PI + 0.8) * 4
    pontos.push(`${x},${y.toFixed(1)}`)
  }
  return 'M' + pontos.join('L')
})

const CARIMBO: Record<string, string> = {
  Eleito: 'var(--color-eleito)',
  'Eleito no 2º turno': 'var(--color-eleito)',
  Reeleito: 'var(--color-reeleito)',
  'Não eleito': 'var(--color-tinta-3)',
}

/** Nos anos 90 o TSE cortava o nome de urna em 30 letras ("…BARROSO DE ARA"): fica até a última palavra inteira. */
function nomeDeUrna(c: Candidatura, nome: string) {
  const n = c.nome_urna
  if (!n) return nomeProprio(nome).toUpperCase()
  const civil = nome.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
  const cortado = n.length >= 30 && civil.startsWith(n) && /\S/.test(civil[n.length] ?? ' ')
  return cortado ? n.replace(/\s+\S*$/, '').replace(/\s+(DE|DA|DO|DAS|DOS|E)$/, '') : n
}

/** O número em casas, como na tela de votação da urna. */
function Casas({ numero, contorno }: { numero: number; contorno?: boolean }) {
  return (
    <span className="flex gap-1" aria-label={`número ${numero}`}>
      {[...String(numero)].map((d, i) => (
        <span
          key={i}
          className={`grid h-[46px] w-[33px] place-items-center rounded-[4px] bg-folha text-[2.15rem] font-black leading-none text-tinta tabular ${contorno ? 'border-[1.5px] border-tinta/75' : 'shadow-[inset_0_-3px_0_rgb(24_32_43/0.13),0_2px_6px_rgb(24_32_43/0.18)]'}`}
          style={{ fontStretch: '78%' }}
          aria-hidden
        >
          {d}
        </span>
      ))}
    </span>
  )
}

function Carimbo({ resultado }: { resultado: string }) {
  return (
    <span
      className="inline-block -rotate-[8deg] rounded-[4px] border-[2.5px] bg-folha/92 px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.1em] shadow-[0_1px_0_rgb(24_32_43/0.08)]"
      style={{ color: CARIMBO[resultado], borderColor: CARIMBO[resultado] }}
    >
      {resultado}
    </span>
  )
}

export function Santinho({ c, nome, inclinacao }: { c: Candidatura; nome: string; inclinacao: number }) {
  const [virado, setVirado] = useState(false)
  const frente = useRef<HTMLButtonElement>(null)
  const verso = useRef<HTMLButtonElement>(null)
  // a face que tinha o foco fica inerte: o foco passa para o botão da outra
  const virar = (v: boolean) => {
    flushSync(() => setVirado(v))
    const alvo = v ? verso : frente
    alvo.current?.focus({ preventScroll: true })
  }
  const resultado = situacao(c)
  const municipal = c.municipio_ibge != null && c.uf
  const { fundo, tinta } = corDoSantinho(c.cod_cargo, c.vies)
  const nomeUrna = nomeDeUrna(c, nome)
  const resumo = `${c.ano}, ${fmtCargo(c.cargo)}${c.numero ? ` número ${c.numero}` : ''}, ${c.partido ?? 'sem partido'}, ${c.local}: ${resultado}`

  return (
    <article
      className="santinho relative h-[404px] w-[236px] shrink-0 snap-start [perspective:1100px]"
      style={{ rotate: `${inclinacao}deg` }}
      aria-label={resumo}
    >
      <div className="santinho-folha relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]" style={{ transform: virado ? 'rotateY(180deg)' : undefined }}>
        {/* FRENTE: o impresso */}
        <div
          className="absolute inset-0 flex flex-col overflow-hidden rounded-[10px] shadow-[var(--shadow-cartao)] [backface-visibility:hidden]"
          style={{ background: fundo, color: tinta }}
          inert={virado}
        >
          <div className="santinho-reticula pointer-events-none absolute inset-0" aria-hidden />
          {/* a foto do TSE tem 161×225: inteira e no tamanho dela, sem esticar nem cortar */}
          <div className="relative flex h-[225px] shrink-0">
            <span className="flex w-[75px] shrink-0 items-start justify-center pt-3">
              <span className="rotate-180 text-[2.6rem] font-black leading-none tabular [writing-mode:vertical-rl]" style={{ fontStretch: '72%' }}>
                {c.ano}
              </span>
            </span>
            <div className="relative h-[225px] w-[161px] shrink-0">
              {/* sem foto (antes de 2004): santinho tipográfico, as iniciais enormes na cor do partido */}
              <Retrato
                foto={c.foto}
                nome={nome}
                tamanho={161}
                className={`!h-full !w-full !rounded-none ${c.foto ? '' : '!bg-transparent !text-[6.5rem] !font-black ![font-stretch:72%] !text-current opacity-25'}`}
              />
            </div>
            <span className="absolute bottom-12 left-2"><Carimbo resultado={resultado} /></span>
          </div>
          <svg width={236} height={70} className="absolute left-0 top-[185px]" aria-hidden>
            {ONDAS.map((d, i) => <path key={i} d={d} stroke={FITAS[i]} strokeWidth={6} fill="none" />)}
          </svg>
          <div className="relative mt-[26px] flex flex-1 flex-col px-3.5 pb-2">
            <p className="line-clamp-2 text-[1.55rem] font-black uppercase leading-[0.92] tracking-[-0.01em] [text-wrap:balance]" style={{ fontStretch: '72%' }}>
              {nomeUrna}
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="truncate text-[0.7rem] font-bold uppercase tracking-[0.14em] opacity-90">{fmtCargo(c.cargo)}</span>
              {c.partido && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-folha py-0.5 pl-1.5 pr-2 text-[0.72rem] font-black text-tinta" style={{ fontStretch: '85%' }}>
                  <i className="size-2 rounded-full" style={{ background: corVies(c.vies) }} aria-hidden />
                  {c.partido}
                </span>
              )}
            </div>
            <div className="mt-auto pt-2">
              {c.numero ? <Casas numero={c.numero} /> : <span className="text-[0.74rem] opacity-80">número não informado</span>}
            </div>
            <p className="mt-2 text-[0.56rem] leading-none opacity-75">Dados do TSE · não é material de campanha</p>
          </div>
          <button
            type="button"
            ref={frente}
            onClick={() => virar(true)}
            className="absolute inset-0 z-10 cursor-pointer rounded-[10px] outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--color-folha),inset_0_0_0_5px_var(--color-tinta)]"
            aria-label={`Virar o santinho de ${c.ano} e ver a cola`}
          />
        </div>

        {/* VERSO: a cola para a urna */}
        <div
          className="absolute inset-0 flex flex-col overflow-hidden rounded-[10px] bg-folha text-tinta shadow-[var(--shadow-cartao)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
          inert={!virado}
        >
          <div className="flex h-[5px]" aria-hidden>
            {FITAS.map((f) => <span key={f} className="flex-1" style={{ background: f }} />)}
          </div>
          <div className="flex flex-1 flex-col px-3.5 pb-3 pt-3">
            <p className="t-mono text-[0.68rem] tracking-[0.14em] text-tinta-3">COLA PARA A URNA</p>
            <p className="mt-1.5 text-[0.8rem] text-tinta-2">Para {fmtCargo(c.cargo).toLowerCase()}, digite</p>
            <div className="mt-1.5">{c.numero ? <Casas numero={c.numero} contorno /> : <span className="text-[0.8rem] text-tinta-3">número não informado</span>}</div>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-dashed border-linha-2 pt-2.5 text-[0.78rem]">
              <dt className="text-tinta-3">Onde</dt><dd className="truncate text-right font-semibold">{c.local}</dd>
              <dt className="text-tinta-3">Partido</dt><dd className="text-right font-semibold">{c.partido ?? 'não informado'}</dd>
              {c.vies != null && (
                <>
                  <dt className="text-tinta-3">Viés do partido</dt>
                  <dd className="flex items-center justify-end gap-1.5 font-semibold tabular">
                    <i className="size-2 rounded-full" style={{ background: corVies(c.vies) }} aria-hidden />
                    {fmtVies(c.vies)}
                  </dd>
                </>
              )}
              {c.votos != null && <><dt className="text-tinta-3">Votos</dt><dd className="text-right font-semibold tabular">{inteiro(c.votos)}</dd></>}
              <dt className="text-tinta-3">Resultado</dt><dd className="text-right font-semibold">{resultado}</dd>
              {c.gasto != null && <><dt className="text-tinta-3">Campanha</dt><dd className="text-right font-semibold tabular">{reaisCurto(c.gasto)}</dd></>}
              {c.gasto != null && c.votos ? <><dt className="text-tinta-3">Por voto</dt><dd className="text-right font-semibold tabular">{reaisCurto(c.gasto / c.votos)}</dd></> : null}
              {c.suplementar && <><dt className="text-tinta-3">Eleição</dt><dd className="text-right font-semibold">suplementar</dd></>}
            </dl>
            <div className="mt-auto space-y-2 pt-2">
              {municipal && (
                <Link
                  to="/uf/$sigla/$ibge"
                  params={{ sigla: c.uf!, ibge: String(c.municipio_ibge) }}
                  className="inline-flex items-center gap-1 text-[0.78rem] font-semibold text-acao hover:underline"
                >
                  Abrir o boletim do município <ArrowRight size={12} weight="bold" aria-hidden />
                </Link>
              )}
              <div className="flex items-end justify-between gap-2">
                <p className="text-[0.62rem] leading-snug text-tinta-3">Santinho reconstruído com dados do TSE. Não é material de campanha.</p>
                <button
                  type="button"
                  ref={verso}
                  onClick={() => virar(false)}
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-linha-2 text-tinta-2 hover:border-tinta hover:text-tinta"
                  aria-label="Desvirar o santinho"
                >
                  <ArrowCounterClockwise size={14} weight="bold" aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
