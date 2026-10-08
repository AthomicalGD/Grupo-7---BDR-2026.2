// Os partidos: o espectro da P7 contado em diploma. Cada partido é uma coluna, da esquerda para a direita
// na ordem do viés e na cor do viés (a cor do partido é o seu viés). A largura é quantos eleitos ele fez
// e a altura, quantos de cada 100 desses eleitos têm superior completo; o traço é a mesma conta entre os
// candidatos. O tracejado é a média de todos os eleitos.
import { useState } from 'react'
import type { PartidoEscola } from '../api'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, nomeProprio, pct, vies as fmtVies } from '../lib/formato'
import { corVies, gradienteVies } from '../lib/vies'
import { useLargura } from './escolaridade'

const ALTURA = 210
const MIN_ELEITOS = 1
const ROTULO = 18 // espaço para o número em cima da coluna

const taxa = (n: number, d: number) => (d ? (100 * n) / d : 0)

/** Sigla para o rótulo: sem espaços ("PC do B" vira "PCdoB") e, se comprida, encurtada com ponto. */
const curta = (sigla: string) => {
  const s = sigla.replace(/\s+/g, '')
  return s.length > 7 ? `${s.slice(0, 5)}.` : s
}

export function Partidos({ partidos, onde }: { partidos: PartidoEscola[]; onde: string }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [foco, setFoco] = useState<PartidoEscola | null>(null)
  const comEleitos = partidos.filter((p) => p.eleitos >= MIN_ELEITOS)
  const totalEleitos = comEleitos.reduce((s, p) => s + p.eleitos, 0)
  const media = taxa(comEleitos.reduce((s, p) => s + p.eleitos_superior, 0), totalEleitos)
  // a escala vai até o maior valor (arredondado para cima), não até 100: as diferenças aparecem
  const topo = Math.min(100, Math.max(50, Math.ceil(Math.max(...comEleitos.flatMap((p) => [taxa(p.eleitos_superior, p.eleitos), taxa(p.candidatos_superior, p.candidatos)])) / 10) * 10))
  const yv = (v: number) => ROTULO + (1 - v / topo) * (ALTURA - ROTULO)
  const VAO = 2
  const util = Math.max(0, largura - VAO * (comEleitos.length - 1))
  const lado = (v: number | null) => (v == null || v === 0 ? 0 : v < 0 ? -1 : 1)
  const grupo = (s: number) => {
    const g = comEleitos.filter((p) => lado(p.vies) === s)
    return { eleitos: g.reduce((a, p) => a + p.eleitos, 0), sup: taxa(g.reduce((a, p) => a + p.eleitos_superior, 0), g.reduce((a, p) => a + p.eleitos, 0)) }
  }
  const esq = grupo(-1), dir = grupo(1)
  const destaques = comEleitos.filter((p) => p.eleitos >= 5)
  const mais = destaques.reduce<PartidoEscola | null>((x, p) => (!x || taxa(p.eleitos_superior, p.eleitos) > taxa(x.eleitos_superior, x.eleitos) ? p : x), null)
  const menos = destaques.reduce<PartidoEscola | null>((x, p) => (!x || taxa(p.eleitos_superior, p.eleitos) < taxa(x.eleitos_superior, x.eleitos) ? p : x), null)

  // a posição de cada coluna é a soma das larguras (e dos vãos) das que vêm antes
  const larguras = comEleitos.map((p) => (p.eleitos / totalEleitos) * util)
  const colunas = comEleitos.map((p, i) => ({ p, w: larguras[i], x: larguras.slice(0, i).reduce((s, w) => s + w + VAO, 0) }))
  const f = foco ? colunas.find((c) => c.p.sigla === foco.sigla) : null
  const estreito = largura > 0 && largura < 640
  const extremos = new Set([mais?.sigla, menos?.sigla])
  const cabe = (sigla: string, w: number) => sigla.length * 6.6 + 4 <= w
  const rotulo = (sigla: string, w: number) => (cabe(sigla, w) ? sigla : cabe(curta(sigla), w) ? curta(sigla) : null)
  const frase = (g: { eleitos: number; sup: number }, lado: string) =>
    g.eleitos ? <><b className="tabular text-tinta">{Math.round(g.sup)} de 100</b>{lado === 'esquerda' ? ' têm superior completo' : ''}</> : <>nenhum partido elegeu alguém{onde}</>

  return (
    <div>
      <p className="max-w-[76ch] text-[1.02rem] leading-relaxed text-tinta-2">
        Entre os eleitos dos partidos à esquerda{onde}, {frase(esq, 'esquerda')}; à direita, {frase(dir, 'direita')}.
        {mais && menos && (
          <> O partido com mais diploma entre os que elegeram ao menos 5 é o <b className="text-tinta">{mais.sigla}</b> ({Math.round(taxa(mais.eleitos_superior, mais.eleitos))} de 100); o com menos, o <b className="text-tinta">{menos.sigla}</b> ({Math.round(taxa(menos.eleitos_superior, menos.eleitos))}).</>
        )}
      </p>

      <div ref={ref} className="relative mt-5" style={{ height: estreito ? 'auto' : ALTURA + 40 }} onPointerLeave={() => setFoco(null)}>
        {estreito && (
          <ol className="space-y-1.5" aria-label="Partidos na ordem do viés, com os eleitos com superior completo">
            {comEleitos.map((p) => {
              const sup = taxa(p.eleitos_superior, p.eleitos)
              const cand = taxa(p.candidatos_superior, p.candidatos)
              return (
                <li key={p.sigla} className={`grid grid-cols-[5.6rem_minmax(0,1fr)_2.2rem] items-center gap-2 text-[0.8rem] ${p.eleitos < 5 ? 'opacity-55' : ''}`}>
                  <span className="flex min-w-0 items-center gap-1 text-tinta">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: corVies(p.vies) }} aria-hidden />
                    <span className="truncate font-semibold">{curta(p.sigla)}</span>
                    <span className="tabular shrink-0 text-[0.68rem] text-tinta-3">{p.eleitos}</span>
                  </span>
                  <span className="relative h-3.5 rounded-[3px] bg-papel-2" aria-hidden>
                    <span className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${(sup / topo) * 100}%`, background: corVies(p.vies) }} />
                    <span className="absolute inset-y-[-2px] w-[2px] bg-tinta" style={{ left: `${(cand / topo) * 100}%` }} />
                  </span>
                  <span className="t-numero tabular text-right text-[0.95rem]">{Math.round(sup)}</span>
                </li>
              )
            })}
          </ol>
        )}
        {largura > 0 && !estreito && (
          <svg width={largura} height={ALTURA + 40} role="img" aria-label={`Partidos na ordem do viés: largura pelos eleitos, altura pelos eleitos com superior completo. Média ${pct(media, 0)}.`}>
            {Array.from({ length: topo / 10 + 1 }, (_, i) => i * 10).map((v) => (
              <g key={v}>
                <line x1={0} x2={largura} y1={yv(v)} y2={yv(v)} stroke="var(--color-linha)" strokeWidth={v ? 0.8 : 1.2} />
                {v > 0 && v % 20 === 0 && <text x={2} y={yv(v) - 3} className="tabular fill-tinta-3 text-[0.66rem]">{v}</text>}
              </g>
            ))}
            {colunas.map(({ p, x: cx, w }) => {
              const sup = taxa(p.eleitos_superior, p.eleitos)
              const cand = taxa(p.candidatos_superior, p.candidatos)
              const ativo = foco?.sigla === p.sigla
              const larg = Math.max(w, 2)
              // o número sai de cima do tracejado da média quando encostaria nele
              const yNum = Math.abs(yv(sup) - 5 - yv(media)) < 12 ? Math.min(yv(sup), yv(media)) - 9 : yv(sup) - 5
              const chamada = extremos.has(p.sigla)
              return (
                <g key={p.sigla} onPointerEnter={() => setFoco(p)} className="cursor-default">
                  <rect x={cx} y={ROTULO} width={larg} height={ALTURA - ROTULO} fill="var(--color-papel-2)" opacity={0.6} />
                  <rect x={cx} y={yv(sup)} width={larg} height={ALTURA - yv(sup)} fill={corVies(p.vies)} stroke={ativo ? 'var(--color-tinta)' : 'none'} strokeWidth={2} />
                  {w >= 6 && <line x1={cx + 1} x2={cx + larg - 1} y1={yv(cand)} y2={yv(cand)} stroke="var(--color-tinta)" strokeWidth={2} />}
                  {/* a base de cada coluna na cor do viés: a ordem é a do viés, a largura é dos eleitos */}
                  <rect x={cx} y={ALTURA + 3} width={larg} height={5} fill={corVies(p.vies)} />
                  {w >= 22 && !chamada && (
                    <text x={cx + w / 2} y={yNum} textAnchor="middle" className="t-numero tabular fill-tinta text-[0.82rem]">
                      {Math.round(sup)}
                    </text>
                  )}
                  {rotulo(p.sigla, w) && (
                    <text x={cx + w / 2} y={ALTURA + 22} textAnchor="middle" className={`text-[0.7rem] ${ativo ? 'fill-tinta font-bold' : 'fill-tinta-2'}`}>
                      {rotulo(p.sigla, w)}
                    </text>
                  )}
                </g>
              )
            })}
            <line x1={0} x2={largura} y1={yv(media)} y2={yv(media)} stroke="var(--color-tinta)" strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none" />
            {/* as chamadas dos extremos do texto ficam por cima de todas as colunas */}
            {colunas.filter((c) => extremos.has(c.p.sigla)).map(({ p, x: cx, w }) => {
              const sup = taxa(p.eleitos_superior, p.eleitos)
              const larg = Math.max(w, 2)
              return (
                <g key={`chamada-${p.sigla}`} pointerEvents="none">
                  {yv(sup) - 2 > Math.max(12, yv(sup) - 20) + 4 && (
                    <line x1={cx + larg / 2} x2={cx + larg / 2} y1={yv(sup) - 2} y2={Math.max(12, yv(sup) - 20) + 4} stroke="var(--color-tinta)" strokeWidth={1} />
                  )}
                  <rect x={Math.min(Math.max(cx + larg / 2, 34), largura - 34) - 32} y={Math.max(0, yv(sup) - 33)} width={64} height={17} rx={4} fill="var(--color-folha)" opacity={0.92} />
                  <text x={Math.min(Math.max(cx + larg / 2, 34), largura - 34)} y={Math.max(12, yv(sup) - 20)} textAnchor="middle" className="t-numero tabular fill-tinta text-[0.82rem]">
                    {p.sigla} {Math.round(sup)}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
        {f && (
          <div
            className="pointer-events-none absolute z-10 w-[230px] rounded-xl border border-linha bg-folha px-3.5 py-3 text-[0.8rem] shadow-[var(--shadow-papel)]"
            style={{ left: Math.min(Math.max(0, f.x + f.w / 2 - 115), largura - 230), top: 8 }}
          >
            <p className="flex items-center gap-1.5 font-bold text-tinta">
              <span className="size-2.5 rounded-full" style={{ background: corVies(f.p.vies) }} aria-hidden />
              {f.p.sigla} <span className="font-normal text-tinta-3">viés {fmtVies(f.p.vies)}</span>
            </p>
            <p className="text-[0.74rem] text-tinta-3">{nomeProprio(f.p.nome)}</p>
            <dl className="tabular mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
              <dt className="text-tinta-2">Eleitos</dt><dd className="text-right font-semibold">{inteiro(f.p.eleitos)}</dd>
              <dt className="text-tinta-2">com superior</dt><dd className="text-right font-semibold">{Math.round(taxa(f.p.eleitos_superior, f.p.eleitos))} de 100</dd>
              <dt className="text-tinta-2">Candidatos</dt><dd className="text-right font-semibold">{inteiro(f.p.candidatos)}</dd>
              <dt className="text-tinta-2">com superior</dt><dd className="text-right font-semibold">{Math.round(taxa(f.p.candidatos_superior, f.p.candidatos))} de 100</dd>
            </dl>
          </div>
        )}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78rem] text-tinta-3">
        <span className="flex items-center gap-1.5">
          esquerda
          <span className="h-2 w-[110px] rounded-full" style={{ background: `linear-gradient(90deg, ${gradienteVies().join(', ')})` }} aria-hidden />
          direita: a ordem e a cor dos partidos{estreito ? '' : '; a largura é quantos eleitos fizeram'}
        </span>
        <span>{estreito ? 'Barra' : 'Coluna cheia'}: eleitos com superior completo.</span>
        <span className="flex items-center gap-1.5"><span className={estreito ? 'h-3 w-0.5 bg-tinta' : 'h-0.5 w-4 bg-tinta'} aria-hidden />os candidatos do partido</span>
        {!estreito && <span className="flex items-center gap-1.5"><span className="w-5 border-t-[1.5px] border-dashed border-tinta" aria-hidden />média dos eleitos, {Math.round(media)} de 100</span>}
        <span>Só partidos que elegeram alguém{estreito ? '; o número miúdo é quantos, e os com menos de 5 ficam claros' : '; passe o mouse para ver os números'}.</span>
      </p>
      <TabelaAlternavel
        titulo="Partidos na ordem do viés: candidatos e eleitos com superior completo"
        colunas={['Partido', 'Viés', 'Candidatos', 'Com superior', 'Eleitos', 'Com superior']}
        linhas={() =>
          partidos.map((p) => [p.sigla, fmtVies(p.vies), inteiro(p.candidatos), pct(taxa(p.candidatos_superior, p.candidatos), 0), inteiro(p.eleitos), p.eleitos ? pct(taxa(p.eleitos_superior, p.eleitos), 0) : '-'])
        }
      />
    </div>
  )
}
