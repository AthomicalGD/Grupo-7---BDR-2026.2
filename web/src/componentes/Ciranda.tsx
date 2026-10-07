// Loading "Apuração": o próprio símbolo da marca trabalhando. As barras sobem e descem como
// uma contagem em andamento e o globo da bandeira gira dentro do V; o visto fica parado.
// Com movimento reduzido, fica o símbolo estático.
import { useId } from 'react'
import { GEO_SIMBOLO as G } from './simbolo'

const COR = { verde: '#1F9A4E', amarelo: '#FBC700', azul: '#2B4C8C', branco: '#FCFDFD', tinta: '#18202B' }
const BARRAS = [COR.verde, COR.verde, COR.amarelo, COR.amarelo]
const QUEDA = [22, 38, 52, 64] // quanto cada barra desce no meio da contagem

// faixa do globo: senoide de período P, repetida, para o giro recomeçar sem emenda
const P = 100
const FAIXA = 'M' + Array.from({ length: 51 }, (_, i) => {
  const x = 74 + i * 4
  return `${x},${(152 + 7 * Math.cos((2 * Math.PI * (x - 74)) / P)).toFixed(1)}`
}).join('L')

export function Ciranda({ rotulo = 'Carregando', tamanho = 128 }: { rotulo?: string; tamanho?: number }) {
  const id = 'ap' + useId().replace(/\W/g, '')
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 text-tinta-2">
      <svg viewBox="0 0 304 248" width={tamanho} height={(tamanho * 248) / 304} aria-hidden>
        <defs>
          {G.barras.map((d, i) => <clipPath key={i} id={`${id}-b${i}`}><path d={d} /></clipPath>)}
          <clipPath id={`${id}-v`}><path d={G.v} /></clipPath>
          <clipPath id={`${id}-g`}><circle cx="124" cy="158" r="46" /></clipPath>
        </defs>
        {G.barras.map((d, i) => (
          <g key={i} clipPath={`url(#${id}-b${i})`}>
            <path
              d={d}
              fill={BARRAS[i]}
              style={{ ['--queda' as string]: `${QUEDA[i]}px`, animation: `apurar 1.6s ease-in-out ${i * 0.14}s infinite` }}
            />
          </g>
        ))}
        <path d={G.v} fill={COR.amarelo} />
        <g clipPath={`url(#${id}-v)`}>
          <circle cx="124" cy="158" r="46" fill={COR.azul} />
          <g clipPath={`url(#${id}-g)`}>
            <g style={{ animation: 'globo 2.8s linear infinite' }}>
              {[0, P].map((dx) => (
                <g key={dx} transform={`translate(${dx} 0)`} fill={COR.branco}>
                  <path d={FAIXA} stroke={COR.branco} strokeWidth={7.5} fill="none" />
                  {G.estrelas.map((e) => <path key={e} d={e} />)}
                </g>
              ))}
            </g>
          </g>
        </g>
        <path d={G.visto} fill={COR.tinta} />
      </svg>
      <p className="t-rotulo tabular">{rotulo}</p>
    </div>
  )
}

/** Loading centralizado ocupando a área de uma tela ou painel. */
export function CirandaTela({ rotulo }: { rotulo?: string }) {
  return (
    <div className="grid min-h-[50dvh] place-items-center">
      <Ciranda rotulo={rotulo} />
    </div>
  )
}
