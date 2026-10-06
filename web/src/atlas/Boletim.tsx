// Boletim do Município: sai da fenda como o papel térmico do boletim de urna.
// Responde a P7 (viés no tempo e espectro) e traz a P3 (indicadores) e os prefeitos (ponte para a P10).
import { X } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { encode } from 'uqr'
import type { Ano, Municipio } from '../api'
import { Retrato } from '../componentes/Retrato'
import { Espectro } from '../graficos/Espectro'
import { ViesTempo } from '../graficos/ViesTempo'
import { decimal, nomeProprio, pct, reais } from '../lib/formato'
import { Trilha } from './Trilha'

function QR({ texto }: { texto: string }) {
  const { data, size } = useMemo(() => encode(texto, { ecc: 'M', border: 0 }), [texto])
  const d = useMemo(() => {
    let s = ''
    data.forEach((linha, y) => {
      let x = 0
      while (x < size) {
        if (!linha[x]) { x++; continue }
        const inicio = x
        while (x < size && linha[x]) x++
        s += `M${inicio} ${y}h${x - inicio}v1h-${x - inicio}z`
      }
    })
    return s
  }, [data, size])
  return (
    <svg viewBox={`-1 -1 ${size + 2} ${size + 2}`} className="size-[92px] shrink-0" role="img" aria-label="QR code com o endereço deste boletim">
      <rect x={-1} y={-1} width={size + 2} height={size + 2} fill="var(--color-folha)" />
      <path d={d} fill="var(--color-tinta)" />
    </svg>
  )
}

const Linha = ({ i, children, className = '' }: { i: number; children: ReactNode; className?: string }) => (
  <div className={`boletim-linha ${className}`} style={{ '--i': i } as CSSProperties}>
    {children}
  </div>
)

const Picote = () => <div className="my-6 border-t-[1.5px] border-dashed border-linha-2" aria-hidden />

function Indicador({ valor, rotulo, fonte }: { valor: string; rotulo: string; fonte: string }) {
  return (
    <div>
      <p className="text-[1.6rem] font-bold leading-none tracking-tight" style={{ fontStretch: '104%' }}>{valor}</p>
      <p className="mt-1.5 text-[0.85rem] font-semibold">{rotulo}</p>
      <p className="text-[0.74rem] text-tinta-3">{fonte}</p>
    </div>
  )
}

export function Boletim({ m, ano, aoFechar }: { m: Municipio; ano: Ano; aoFechar: () => void }) {
  const ind = m.indicadores
  const [emitido] = useState(() => new Date().toLocaleDateString('pt-BR'))
  const url = typeof window !== 'undefined' ? window.location.href : ''
  return (
    <div>
      <Trilha uf={m.uf_nome} municipio={m.nome} />
      <div className="relative mt-4">
        <div className="h-3 rounded-full bg-tinta shadow-[inset_0_-2px_0_rgb(255_255_255/0.08)]" aria-hidden />
        <div className="mx-3 -mt-1.5 [filter:drop-shadow(0_14px_22px_rgb(42_53_80/0.16))_drop-shadow(0_1px_1px_rgb(42_53_80/0.08))]">
        <article aria-labelledby="boletim-titulo" className="boletim-papel relative bg-folha px-6 pb-12 pt-7 sm:px-9">
          <Linha i={0} className="flex items-start justify-between gap-4">
            <div>
              <p className="t-mono text-[0.78rem] tracking-[0.2em] text-tinta-2">BOLETIM DO MUNICÍPIO</p>
              <h2 id="boletim-titulo" className="t-h1 mt-2">{m.nome}</h2>
              <p className="t-mono mt-2 text-[0.74rem] uppercase tracking-[0.06em] text-tinta-3">
                {m.uf} · Região intermediária {m.regiao_intermediaria} · IBGE {m.ibge}
              </p>
            </div>
            <button type="button" onClick={aoFechar} className="-mr-2 rounded-full p-2 text-tinta-2 hover:bg-papel hover:text-tinta" aria-label="Fechar o boletim e voltar ao estado">
              <X size={20} weight="bold" />
            </button>
          </Linha>

          {!m.carregada ? (
            <Linha i={1}>
              <Picote />
              <p className="text-tinta-2">
                O estado deste município não foi carregado no banco. Carregue com{' '}
                <code className="t-mono">python -m loader {m.uf}</code>.
              </p>
            </Linha>
          ) : (
            <>
              <Picote />
              <Linha i={1}>
                <h3 className="t-h3">Viés na linha do tempo</h3>
                <p className="mb-3 text-[0.85rem] text-tinta-3">{m.nome} comparado ao estado</p>
                <ViesTempo principal={{ nome: m.nome, valores: m.vies }} contexto={{ nome: m.uf_nome, valores: m.vies_uf }} anoAtivo={ano} />
              </Linha>

              <Linha i={2} className="mt-8">
                <h3 className="t-h3">Espectro do voto</h3>
                <p className="mb-4 text-[0.85rem] text-tinta-3">Votos válidos por partido, do mais à esquerda ao mais à direita</p>
                <Espectro espectro={m.espectro} anoAtivo={ano} />
                {m.sem_vies_pct[ano] != null && (
                  <p className="mt-3 text-[0.78rem] text-tinta-3">Votos em partidos sem viés informado em {ano}: {pct(m.sem_vies_pct[ano])}</p>
                )}
              </Linha>

              <Picote />
              <Linha i={3}>
                <h3 className="t-h3">Prefeitos eleitos</h3>
                <p className="mb-4 text-[0.85rem] text-tinta-3">Abra a carreira de cada um</p>
                <ol className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  {m.prefeitos.map((p) => (
                    <li key={p.ano + p.nome}>
                      <Link to="/politico/$id" params={{ id: String(p.id_politico) }} className="group block">
                        <Retrato foto={p.foto} nome={p.nome} tamanho={52} className="transition-transform group-hover:-translate-y-0.5" />
                        <p className="mt-1.5 tabular text-[0.78rem] font-bold">{p.ano}{p.turno === 2 ? ' · 2º turno' : ''}</p>
                        <p className="line-clamp-2 text-[0.8rem] leading-snug group-hover:underline">{nomeProprio(p.nome)}</p>
                        <p className="t-mono text-[0.7rem] text-tinta-3">{p.partido}</p>
                      </Link>
                    </li>
                  ))}
                </ol>
              </Linha>

              <Picote />
              <Linha i={4}>
                <h3 className="t-h3 mb-4">Indicadores do município</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-6">
                  <Indicador valor={reais(ind.pib_per_capita?.valor)} rotulo="PIB per capita" fonte={`${ind.pib_per_capita?.ano ?? '-'} · IBGE`} />
                  <Indicador valor={ind.idhm ? decimal(ind.idhm.valor, 3) : '-'} rotulo="IDHM" fonte={`${ind.idhm?.ano ?? '-'} · Atlas Brasil`} />
                  <Indicador valor={pct(ind.eleitores_populacao?.valor)} rotulo="Eleitores / população" fonte={`${ind.eleitores_populacao?.ano ?? '-'} · TSE e IBGE`} />
                  <Indicador valor={pct(ind.isentos?.valor)} rotulo="Isentos no 1º turno" fonte={`brancos, nulos e abstenções, ${ind.isentos?.ano ?? '-'}`} />
                </div>
              </Linha>
            </>
          )}

          <Picote />
          <Linha i={5} className="flex items-center gap-5">
            <QR texto={url} />
            <div className="space-y-1">
              <p className="font-semibold">Aponte a câmera para abrir este boletim</p>
              <p className="t-mono text-[0.72rem] uppercase tracking-[0.06em] text-tinta-3">Emitido em {emitido} · Fontes: TSE, IBGE, Atlas Brasil</p>
              <p className="text-[0.78rem] text-tinta-3">Viés: média do viés dos partidos ponderada pelos votos válidos, todos os cargos do 1º turno.</p>
            </div>
          </Linha>
        </article>
        </div>
      </div>
    </div>
  )
}
