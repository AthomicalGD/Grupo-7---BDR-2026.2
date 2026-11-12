// A conta das cadeiras, em três passos e com os números de verdade do estado escolhido: o valor de uma cadeira
// (quociente eleitoral), quantas cadeiras inteiras cabem nos votos de um partido (quociente partidário) e quem leva
// as que sobraram (maior média). Os números vêm da API; a classificação oficial do TSE continua sendo a das fileiras.
import { Armchair, Divide, Equals } from '@phosphor-icons/react'
import type { ContaLegenda } from '../api'
import { LogoPartido } from '../componentes/LogoPartido'
import { inteiro } from '../lib/formato'

const dec = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Um número grande com o nome dele embaixo, como uma peça de azulejo. */
function Numero({ valor, nome, destaque = false }: { valor: string; nome: string; destaque?: boolean }) {
  return (
    <span className={`inline-flex min-w-0 flex-col items-center rounded-[10px] border-[2.5px] border-tinta px-3 py-2 text-center ${destaque ? 'bg-[var(--amarelo)]' : 'bg-folha'}`}>
      <span className="t-numero tabular text-[clamp(1.2rem,1rem+1.4vw,1.85rem)] leading-none text-tinta">{valor}</span>
      <span className="mt-1 text-[0.72rem] font-semibold leading-tight text-tinta-2">{nome}</span>
    </span>
  )
}

function Operador({ tipo }: { tipo: 'dividido' | 'igual' }) {
  const Icone = tipo === 'dividido' ? Divide : Equals
  return <Icone size={20} weight="bold" aria-label={tipo === 'dividido' ? 'dividido por' : 'igual a'} className="shrink-0 text-tinta" />
}

/** O operador e o número que vem depois dele andam juntos: ao quebrar a linha, o "=" nunca fica sozinho. */
function Depois({ tipo, children }: { tipo: 'dividido' | 'igual'; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-2 whitespace-nowrap"><Operador tipo={tipo} />{children}</span>
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="min-w-0 bg-folha p-4 sm:p-5">
      <h3 className="flex items-center gap-2.5 text-[1.02rem] font-extrabold leading-tight text-tinta" style={{ fontFamily: 'var(--font-display)' }}>
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-tinta text-[0.85rem] font-extrabold text-white">{n}</span>
        {titulo}
      </h3>
      <div className="mt-4">{children}</div>
    </li>
  )
}

export function Conta({ conta }: { conta: ContaLegenda }) {
  const exemplo = conta.partidos[0]
  const inteiras = exemplo ? Math.floor(exemplo.quocientes) : 0
  const sobra = exemplo ? exemplo.quocientes - inteiras : 0
  const { rodadas, atras } = conta.sobras
  const rotuloDoLugar = conta.cargo.cod === 13 ? `Exemplo: ${conta.local}` : conta.local

  return (
    <section aria-labelledby="conta-cadeiras" className="mt-8">
      <h2 id="conta-cadeiras" className="t-h2 flex flex-wrap items-baseline gap-x-3">
        A conta das cadeiras
        <span className="text-[0.95rem] font-semibold text-tinta-2">{rotuloDoLugar} · {conta.ano} · {conta.cargo.nome.toLowerCase()}</span>
      </h2>
      <ol className="mt-4 grid gap-[3px] overflow-hidden rounded-[var(--canto)] border-[3px] border-tinta bg-tinta lg:grid-cols-3">
        <Passo n={1} titulo="Quanto vale uma cadeira?">
          <div className="flex flex-wrap items-center gap-2">
            <Numero valor={inteiro(conta.validos)} nome="votos válidos" />
            <Depois tipo="dividido"><Numero valor={inteiro(conta.vagas)} nome="cadeiras" /></Depois>
            <Depois tipo="igual"><Numero valor={inteiro(conta.qe)} nome="votos por cadeira" destaque /></Depois>
          </div>
          <p className="mt-3 text-[0.8rem] text-tinta-2">quociente eleitoral</p>
        </Passo>

        <Passo n={2} titulo="Quantas cadeiras cabem nos votos do partido?">
          {exemplo ? (
            <>
              <p className="mb-2 flex items-center gap-2 text-[0.9rem] font-bold text-tinta"><LogoPartido sigla={exemplo.sigla} reservar={false} /> {exemplo.sigla}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Numero valor={inteiro(exemplo.votos)} nome={`votos do ${exemplo.sigla}`} />
                <Depois tipo="dividido"><Numero valor={inteiro(conta.qe)} nome="votos por cadeira" /></Depois>
                <Depois tipo="igual"><Numero valor={dec(exemplo.quocientes)} nome="cadeiras de votos" destaque /></Depois>
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.86rem] text-tinta">
                <span className="inline-flex gap-1" aria-hidden>
                  {Array.from({ length: Math.min(inteiras, 8) }, (_, k) => (
                    <span key={k} className="grid size-6 place-items-center rounded-[5px] border-2 border-tinta bg-[var(--azul)] text-white"><Armchair size={14} weight="fill" /></span>
                  ))}
                </span>
                <b>{inteiras} {inteiras === 1 ? 'inteira' : 'inteiras'}</b>
                <span className="text-tinta-2">e sobra {dec(sobra)} para a próxima fase</span>
              </p>
            </>
          ) : (
            <p className="text-[0.86rem] text-tinta-2">Sem votos de partido neste recorte.</p>
          )}
          <p className="mt-3 text-[0.8rem] text-tinta-2">quociente partidário</p>
        </Passo>

        <Passo n={3} titulo={conta.sobras.vagas > 0 ? `Quem leva as ${conta.sobras.vagas} que sobraram?` : 'Sobrou alguma cadeira?'}>
          {rodadas.length > 0 ? (
            <>
              <ol className="space-y-1.5">
                {rodadas.map((r, k) => {
                  const p = conta.partidos.find((x) => x.sigla === r.sigla)
                  return (
                    <li key={k} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.86rem]">
                      <span aria-hidden className="grid size-6 place-items-center rounded-[5px] border-2 border-tinta bg-[var(--amarelo)] text-tinta"><Armchair size={14} weight="fill" /></span>
                      <LogoPartido sigla={r.sigla} tamanho="p" reservar={false} />
                      <b className="text-tinta">{r.sigla}</b>
                      <span className="tabular text-tinta-2">
                        {p ? `${inteiro(p.votos)} ÷ ${r.cadeiras_antes + 1} = ` : ''}<b className="text-tinta">{inteiro(r.media)}</b>
                      </span>
                    </li>
                  )
                })}
              </ol>
              {atras.length > 0 && (
                <p className="tabular mt-2 text-[0.8rem] text-tinta-3">
                  Ficaram atrás: {atras.map((a, k) => <span key={a.sigla}>{k > 0 && ', '}<LogoPartido sigla={a.sigla} tamanho="p" reservar={false} /> {a.sigla} {inteiro(a.media)}</span>)}
                </p>
              )}
            </>
          ) : (
            <p className="text-[0.86rem] text-tinta-2">Todas as cadeiras saíram direto dos votos.</p>
          )}
          <p className="mt-3 text-[0.8rem] text-tinta-2">maior média: votos ÷ (cadeiras já ganhas + 1)</p>
        </Passo>
      </ol>
      {conta.lista && (
        <p className="mt-3 text-[0.82rem] text-tinta-2">
          Em {conta.ano}, partidos em {conta.lista === 'federação' ? 'federação' : 'coligação'} somam votos e as cadeiras são contadas para o grupo todo.
        </p>
      )}
    </section>
  )
}
