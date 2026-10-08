// A régua dos municípios: em cinco grupos do mesmo tamanho, do eleitorado menos ao mais escolarizado,
// a % com superior completo de quem votou (anel), dos candidatos do município (traço) e de quem ele
// elegeu ou em quem votou (ponto). O trecho entre o anel e o ponto é a distância entre o eleitor e o
// eleito; a última linha põe o município escolhido na mesma régua.
import type { Escola, EscolaLugar } from '../api'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { decimal, pct } from '../lib/formato'
import { cor, useLargura } from './escolaridade'

const ROTULOS = ['Menos escolarizados', '2º quinto', '3º quinto', '4º quinto', 'Mais escolarizados']

interface Linha {
  rotulo: string
  sub: string
  votantes: number | null
  candidatos: number | null
  alvo: number | null
  lugar?: boolean
}

export function Regua({ dados, lugar }: { dados: Escola; lugar?: EscolaLugar }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const estreito = largura < 560
  const medida = dados.medida
  const linhas: Linha[] = dados.quintis.map((q, i) => ({
    rotulo: ROTULOS[i],
    sub: `${decimal(q.de)} a ${decimal(q.ate)}% votou com superior`,
    votantes: q.votantes,
    candidatos: medida === 'eleitos' ? q.candidatos : null,
    alvo: q[medida],
  }))
  if (lugar && lugar.pct.votantes != null) {
    linhas.push({
      rotulo: lugar.nome,
      sub: lugar.quintil ? `${lugar.quintil}º quinto` : '',
      votantes: lugar.pct.votantes,
      candidatos: medida === 'eleitos' ? lugar.pct.candidatos : null,
      alvo: lugar.pct[medida],
      lugar: true,
    })
  }
  const maior = Math.max(...linhas.map((l) => l.alvo ?? 0))
  const fim = Math.min(100, Math.ceil((maior + 6) / 10) * 10)
  const ROT = estreito ? 16 : 172
  const util = Math.max(120, largura - ROT - 44)
  const x = (v: number) => ROT + (v / fim) * util
  const ALT = estreito ? 70 : 58
  const TOPO = 30
  const altura = TOPO + linhas.length * ALT + 6
  const nomeAlvo = medida === 'eleitos' ? 'eleitos do município' : 'votos para deputado'

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem] text-tinta-2">
        <li className="flex items-center gap-1.5">
          <svg width={14} height={14} aria-hidden><circle cx={7} cy={7} r={5} fill="var(--color-folha)" stroke="var(--color-tinta-2)" strokeWidth={1.8} /></svg>
          quem votou
        </li>
        {medida === 'eleitos' && (
          <li className="flex items-center gap-1.5">
            <svg width={6} height={14} aria-hidden><line x1={3} x2={3} y1={1} y2={13} stroke="var(--color-tinta-2)" strokeWidth={2} /></svg>
            candidatos do município
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <svg width={14} height={14} aria-hidden><circle cx={7} cy={7} r={5.5} fill={cor(8)} /></svg>
          {nomeAlvo}
        </li>
      </ul>
      <div ref={ref} style={{ height: altura }}>
        {largura > 0 && (
          <svg
            width={largura}
            height={altura}
            role="img"
            aria-label={`Régua, % com superior completo: ${linhas.map((l) => `${l.rotulo}, quem votou ${pct(l.votantes)}, ${nomeAlvo} ${pct(l.alvo)}`).join('; ')}`}
          >
            {Array.from({ length: fim / 10 + 1 }, (_, i) => i * 10).map((v) => (
              <g key={v}>
                <line x1={x(v)} x2={x(v)} y1={TOPO - 6} y2={altura - 4} stroke="var(--color-linha)" strokeWidth={v ? 1 : 1.5} />
                <text x={x(v)} y={TOPO - 12} textAnchor="middle" className="tabular fill-tinta-3 text-[0.72rem]">{v}%</text>
              </g>
            ))}
            {linhas.map((l, i) => {
              const yc = TOPO + i * ALT + (estreito ? 40 : ALT / 2)
              const temPar = l.votantes != null && l.alvo != null
              return (
                <g key={l.rotulo}>
                  {l.lugar && <rect x={0} y={yc - (estreito ? 38 : 27)} width={largura} height={estreito ? 66 : 54} rx={8} fill="var(--color-papel-2)" />}
                  <text x={estreito ? 0 : 0} y={estreito ? yc - 20 : yc - 2} className={`text-[0.86rem] ${l.lugar ? 'fill-tinta font-bold' : 'fill-tinta'}`}>
                    {l.rotulo}
                  </text>
                  {!estreito && <text x={0} y={yc + 14} className="tabular fill-tinta-3 text-[0.72rem]">{l.sub}</text>}
                  {temPar && (
                    <>
                      <line x1={x(l.votantes!)} x2={x(l.alvo!)} y1={yc} y2={yc} stroke={cor(4)} strokeWidth={7} strokeLinecap="round" opacity={0.55} />
                      {l.candidatos != null && <line x1={x(l.candidatos)} x2={x(l.candidatos)} y1={yc - 9} y2={yc + 9} stroke="var(--color-tinta-2)" strokeWidth={2} />}
                      <circle cx={x(l.votantes!)} cy={yc} r={6} fill="var(--color-folha)" stroke="var(--color-tinta-2)" strokeWidth={2} />
                      {l.lugar && <circle cx={x(l.alvo!)} cy={yc} r={10} fill="none" stroke="var(--color-marcador)" strokeWidth={3} />}
                      <circle cx={x(l.alvo!)} cy={yc} r={7} fill={cor(8)} />
                      <text x={x(l.votantes!)} y={yc + 21} textAnchor="middle" className="tabular fill-tinta-2 text-[0.76rem]">
                        {decimal(l.votantes!)}%
                      </text>
                      <text x={x(l.alvo!) + 12} y={yc + 5} className="t-numero tabular fill-tinta text-[1rem]">{decimal(l.alvo!)}%</text>
                    </>
                  )}
                </g>
              )
            })}
          </svg>
        )}
      </div>
      <TabelaAlternavel
        titulo="% com superior completo, por quinto de municípios"
        colunas={medida === 'eleitos' ? ['Grupo', 'Municípios', 'Quem votou', 'Candidatos', 'Eleitos'] : ['Grupo', 'Municípios', 'Quem votou', 'Votos para deputado']}
        linhas={() =>
          dados.quintis.map((q, i) => [
            `${ROTULOS[i]} (${decimal(q.de)} a ${decimal(q.ate)}%)`,
            String(q.municipios),
            pct(q.votantes),
            ...(medida === 'eleitos' ? [pct(q.candidatos), pct(q.eleitos)] : [pct(q.votados)]),
          ])
        }
      />
    </div>
  )
}
