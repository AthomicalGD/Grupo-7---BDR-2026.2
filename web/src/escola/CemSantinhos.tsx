// De cada 100 santinhos, quantos viram cadeira: um quadro de 100 santinhos para cada grau de
// escolaridade, do menor para o maior, como no Isotype: cada santinho vale 1% dos candidatos daquele
// grau. Os eleitos ficam no verde de quem venceu e enchem o quadro como uma barra: de baixo para cima
// nos quadros 10x10 (largo) e da esquerda para a direita nas faixas 25x4 (estreito, um grau por linha).
// O tracejado é a média do cargo.
import { useReducedMotion } from 'motion/react'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, pct, plural } from '../lib/formato'
import { cor, useLargura } from './escolaridade'

const MINIMO = 30 // graus com menos candidatos viram nota: 1 em 2 não é 50%
const CONTORNO = '#87919d' // santinho vazio: 3,1:1 sobre a folha

function Santinho({ x, y, w, h, eleito, atraso }: { x: number; y: number; w: number; h: number; eleito: boolean; atraso: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={Math.min(1.6, w / 4)}
      fill={eleito ? 'var(--color-eleito)' : 'var(--color-folha)'}
      stroke={eleito ? 'var(--color-eleito)' : CONTORNO}
      strokeWidth={0.8}
      className="transition-[fill,stroke] duration-300"
      style={{ transitionDelay: `${atraso}ms` }}
    />
  )
}

export function CemSantinhos({ candidatos, eleitos, rotulos, destaque, aoDestacar }: {
  candidatos: number[]
  eleitos: number[]
  rotulos: string[]
  destaque: number
  aoDestacar: (nivel: number) => void
}) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const reduzir = useReducedMotion()
  const estreito = largura < 560
  const graus = [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => candidatos[n - 1] >= MINIMO)
  const poucos = [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => candidatos[n - 1] > 0 && candidatos[n - 1] < MINIMO)
  const total = candidatos.reduce((s, c) => s + c, 0)
  const media = total ? (100 * eleitos.reduce((s, e) => s + e, 0)) / total : 0
  const taxa = (n: number) => Math.round((100 * eleitos[n - 1]) / candidatos[n - 1])

  // largo: quadros 10x10 lado a lado; estreito: faixas de 25 colunas por 4 fileiras
  const porLinha = largura >= 900 ? graus.length : 4
  const VAO = largura >= 900 ? 34 : 18
  const quadro = estreito ? largura : Math.min(124, (largura - (porLinha - 1) * VAO) / porLinha)
  const cols = estreito ? 25 : 10
  const fils = estreito ? 4 : 10
  const passo = quadro / cols
  const w = passo - 2.2
  const h = w * (estreito ? 1.25 : 1.45) // proporção de santinho (mais baixo na faixa)
  const pa = h + 2.2
  const alt = pa * fils - 2.2
  // posição do santinho j (0 = o primeiro a encher)
  const pos = (j: number) =>
    estreito
      ? { x: Math.floor(j / fils) * passo, y: alt - ((j % fils) + 1) * pa + 2.2 } // coluna a coluna, da esquerda
      : { x: (j % cols) * passo, y: alt - (Math.floor(j / cols) + 1) * pa + 2.2 } // fileira a fileira, de baixo
  const xMedia = (media / fils) * passo - 1.1
  const yMedia = alt - (media / cols) * pa + 1.1

  return (
    <div ref={ref}>
      {largura > 0 && (
        <ol
          className={estreito ? 'grid gap-y-6' : 'grid justify-between gap-y-8'}
          style={estreito ? undefined : { gridTemplateColumns: `repeat(${porLinha}, ${quadro}px)`, columnGap: VAO }}
        >
          {graus.map((n) => {
            const k = taxa(n)
            const ativo = n === destaque
            const rotulo = (
              <span className={estreito ? 'flex items-baseline gap-3' : 'block'}>
                <span className={`flex items-baseline gap-1 ${estreito ? 'order-2 ml-auto' : 'mt-3'}`}>
                  <span className={`t-numero tabular ${estreito ? 'text-[1.6rem]' : 'text-[2rem]'} ${ativo ? 'text-eleito' : 'text-tinta'}`}>{k}</span>
                  <span className="text-[0.8rem] text-tinta-3">de 100</span>
                </span>
                <span className="block">
                  <span className="mt-1.5 flex items-start gap-1.5">
                    <span className="mt-[3px] size-2.5 shrink-0 rounded-[2px]" style={{ background: cor(n) }} aria-hidden />
                    <span className={`text-[0.86rem] leading-tight ${ativo ? 'font-bold text-tinta' : 'text-tinta-2'}`}>{rotulos[n - 1]}</span>
                  </span>
                  <span className="tabular mt-0.5 block pl-4 text-[0.74rem] text-tinta-3">{plural(candidatos[n - 1], 'candidato', 'candidatos')}</span>
                </span>
              </span>
            )
            const desenho = (
              <svg width={quadro} height={alt + 4} aria-hidden className={`overflow-visible ${estreito ? 'mt-2' : ''}`}>
                {Array.from({ length: 100 }, (_, j) => (
                  <Santinho key={j} {...pos(j)} w={w} h={h} eleito={j < k} atraso={reduzir ? 0 : j * 5} />
                ))}
                {estreito ? (
                  <line x1={xMedia} x2={xMedia} y1={-5} y2={alt + 5} stroke="var(--color-tinta)" strokeWidth={1.5} strokeDasharray="4 3" />
                ) : (
                  <line x1={-6} x2={quadro + 6} y1={yMedia} y2={yMedia} stroke="var(--color-tinta)" strokeWidth={1.5} strokeDasharray="4 3" />
                )}
              </svg>
            )
            return (
              <li key={n} onPointerEnter={() => aoDestacar(n)}>
                <button
                  type="button"
                  onClick={() => aoDestacar(n)}
                  onFocus={() => aoDestacar(n)}
                  aria-label={`${rotulos[n - 1]}: ${k} de cada 100 candidatos se elegeram (${inteiro(eleitos[n - 1])} de ${inteiro(candidatos[n - 1])})`}
                  className="block w-full rounded text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acao"
                >
                  {estreito ? <>{rotulo}{desenho}</> : <>{desenho}{rotulo}</>}
                </button>
              </li>
            )
          })}
        </ol>
      )}
      <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-linha pt-3 text-[0.82rem] text-tinta-3">
        <span className="flex items-center gap-1.5">
          <svg width={9} height={13} aria-hidden><rect x={0.5} y={0.5} width={8} height={12} rx={1.5} fill="var(--color-eleito)" /></svg>
          eleito
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={9} height={13} aria-hidden><rect x={0.5} y={0.5} width={8} height={12} rx={1.5} fill="var(--color-folha)" stroke={CONTORNO} /></svg>
          não eleito
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={22} height={6} aria-hidden><line x1={0} x2={22} y1={3} y2={3} stroke="var(--color-tinta)" strokeWidth={1.5} strokeDasharray="4 3" /></svg>
          média do cargo, {Math.round(media)} de 100
        </span>
        <span>Cada santinho vale 1% dos candidatos do grau, arredondado.</span>
      </p>
      {poucos.length > 0 && (
        <p className="mt-1.5 text-[0.82rem] text-tinta-3">
          Com menos de {MINIMO} candidatos, fora da conta:{' '}
          {poucos.map((n) => `${rotulos[n - 1].toLowerCase()} (${plural(candidatos[n - 1], 'candidato', 'candidatos')}, ${eleitos[n - 1] ? plural(eleitos[n - 1], 'eleito', 'eleitos') : 'nenhum eleito'})`).join('; ')}.
        </p>
      )}
      <TabelaAlternavel
        titulo="Candidatos e eleitos por grau de escolaridade"
        colunas={['Escolaridade', 'Candidatos', 'Eleitos', 'De cada 100']}
        linhas={() =>
          [8, 7, 6, 5, 4, 3, 2, 1]
            .filter((n) => candidatos[n - 1] > 0)
            .map((n) => [rotulos[n - 1], inteiro(candidatos[n - 1]), inteiro(eleitos[n - 1]), pct((100 * eleitos[n - 1]) / candidatos[n - 1])])
        }
      />
    </div>
  )
}
