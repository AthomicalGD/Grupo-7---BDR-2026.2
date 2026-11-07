// Boletim do Município: sai da fenda como o papel térmico do boletim de urna.
// Responde a P7 (viés no tempo e espectro) e traz a P3 (indicadores), a galeria dos prefeitos e a idade (P6) e a
// ponte para a carreira de cada prefeito (P10).
import { ArrowRight, X } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { encode } from 'uqr'
import { enderecoParaOutroAparelho } from '../lib/rede'
import { consultas, type Ano, type Municipio } from '../api'
import { Retrato } from '../componentes/Retrato'
import { AlinhamentoCamara } from '../graficos/AlinhamentoCamara'
import { Espectro } from '../graficos/Espectro'
import { ViesTempo } from '../graficos/ViesTempo'
import { decimal, nomeProprio, pct, plural, reais, reaisCurto } from '../lib/formato'
import { Galeria } from '../idade/Galeria'
import { anos as fmtAnos, COR_TERCO, NOME_TERCO, resumoPassagens, tintaSobreSepia } from '../idade/sepia'
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

/** Os prefeitos na galeria compacta (1996 a 2024, com a marca de cada passagem) e a idade de quem votou (P6).
 *  Enquanto a P6 não chega, a lista simples de prefeitos que já veio com o município. */
function PrefeitosEIdade({ m }: { m: Municipio }) {
  const { data: idade } = useQuery(consultas.idadeMunicipio(m.ibge))
  const a24 = idade?.anos['2024']
  return (
    <>
      <Linha i={3}>
        <h3 className="t-h3">Prefeitos eleitos</h3>
        {idade?.galeria.length ? (
          <>
            <p className="mb-4 text-[0.85rem] text-tinta-3">De 1996 a 2024, com a marca de cada passagem: = mesmo partido, ≠ troca, ~ com ressalva (fusão)</p>
            <Galeria dados={idade} compacta />
            {idade.passagens && <p className="t-mono mt-3 text-[0.74rem] uppercase tracking-[0.04em] text-tinta-2">{resumoPassagens(idade.passagens)}</p>}
          </>
        ) : (
          <>
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
          </>
        )}
      </Linha>
      {a24 && (
        <>
          <Picote />
          <Linha i={4}>
            <p className="t-mono text-[0.78rem] tracking-[0.2em] text-tinta-2">IDADE</p>
            <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[0.86rem]">
              <dt className="text-tinta-2">Quem votou em 2024</dt>
              <dd className="tabular text-right font-bold text-tinta">{fmtAnos(a24.idade)} anos</dd>
              <dt className="text-tinta-2">Terço no estado e no país</dt>
              <dd className="flex justify-end gap-1.5">
                {([['estado', a24.terco_uf], ['país', a24.terco]] as const).map(([onde, t]) => (
                  <span key={onde} className="rounded-full px-2 py-0.5 text-[0.74rem] font-semibold" style={{ background: COR_TERCO[t], color: tintaSobreSepia(t === 1 ? 1 : t === 2 ? 3 : 5) }}>
                    {onde}: {NOME_TERCO[t]}
                  </span>
                ))}
              </dd>
              <dt className="text-tinta-2">População (Censo 2022)</dt>
              <dd className="tabular text-right text-tinta">{fmtAnos(idade?.idade_pop)} anos</dd>
              <dt className="text-tinta-2">Quem votou com 60+ / com 16 a 29</dt>
              <dd className="tabular text-right text-tinta">{pct(a24.pct_60, 0)} / {pct(a24.pct_16_29, 0)}</dd>
            </dl>
            <Link to="/idade" search={{ uf: m.uf === 'DF' ? undefined : m.uf, ibge: m.ibge }} className="mt-4 inline-flex items-center gap-1.5 text-[0.86rem] font-semibold text-acao hover:underline">
              Jovem vota no jovem? Ver a P6 <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
          </Linha>
        </>
      )}
    </>
  )
}

export function Boletim({ m, ano, cargo, aoFechar }: { m: Municipio; ano: Ano; cargo?: string; aoFechar: () => void }) {
  const ind = m.indicadores
  const [emitido] = useState(() => new Date().toLocaleDateString('pt-BR'))
  const url = typeof window !== 'undefined' ? enderecoParaOutroAparelho() : ''
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
                  <p className="mt-3 text-[0.78rem] text-tinta-3">Votos em partidos sem viés em {ano} (ficam fora da média): {pct(m.sem_vies_pct[ano])}</p>
                )}
              </Linha>

              <Linha i={2} className="mt-8">
                <h3 className="t-h3">Alinhamento na Câmara</h3>
                <p className="mb-3 text-[0.85rem] text-tinta-3">{m.nome} comparado ao estado</p>
                <AlinhamentoCamara nome={m.nome} valores={m.alinhamento} contexto={{ nome: m.uf_nome, valores: m.alinhamento_uf }} anoAtivo={ano} />
              </Linha>

              <Picote />
              <PrefeitosEIdade m={m} />

              {m.cadeiras.length > 0 && (
                <>
                  <Picote />
                  <Linha i={4}>
                    <h3 className="t-h3">Quanto custou cada cadeira</h3>
                    <p className="mb-4 text-[0.85rem] text-tinta-3">Gasto médio dos eleitos, em reais de 2024</p>
                    <table className="w-full text-[0.88rem] tabular">
                      <caption className="sr-only">Custo da cadeira de prefeito e de vereador em {m.nome}</caption>
                      <thead>
                        <tr className="text-left text-[0.78rem] text-tinta-3">
                          <th scope="col" className="pb-2 font-semibold">Cargo</th>
                          {[2020, 2024].map((a) => <th key={a} scope="col" className="pb-2 text-right font-semibold">{a}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {[11, 13].map((cod) => {
                          const linhas = m.cadeiras.filter((c) => c.cod_cargo === cod)
                          if (!linhas.length) return null
                          return (
                            <tr key={cod} className="border-t border-linha">
                              <th scope="row" className="py-2.5 text-left font-semibold">{linhas[0].cargo}</th>
                              {[2020, 2024].map((a) => {
                                const c = linhas.find((l) => l.ano === a)
                                return (
                                  <td key={a} className="py-2.5 text-right">
                                    <span className="block font-bold">{c?.custo_cadeira != null ? reaisCurto(c.custo_cadeira * c.fator_ipca) : '-'}</span>
                                    {c && <span className="block text-[0.74rem] text-tinta-3">{plural(c.candidatos, 'candidato', 'candidatos')}, {plural(c.cadeiras, 'vaga', 'vagas')}</span>}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <Link
                      to="/cadeira"
                      search={{ cargo: 13, ano: 2024, uf: m.uf, municipio: m.ibge }}
                      className="mt-3 inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-acao hover:underline"
                    >
                      Ver a câmara no plenário <ArrowRight size={14} weight="bold" aria-hidden />
                    </Link>
                  </Linha>
                </>
              )}

              <Picote />
              <Linha i={5}>
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
          <Linha i={6} className="flex items-center gap-5">
            <QR texto={url} />
            <div className="space-y-1">
              <p className="font-semibold">Aponte a câmera para abrir este boletim</p>
              <p className="t-mono text-[0.72rem] uppercase tracking-[0.06em] text-tinta-3">Emitido em {emitido} · Fontes: TSE, IBGE, Atlas Brasil</p>
              <p className="text-[0.78rem] text-tinta-3">Viés: média do viés dos partidos ponderada pelos votos válidos, {cargo ? `só o voto para ${cargo.toLowerCase()}` : 'todos os cargos do 1º turno'}.</p>
            </div>
          </Linha>
        </article>
        </div>
      </div>
    </div>
  )
}
