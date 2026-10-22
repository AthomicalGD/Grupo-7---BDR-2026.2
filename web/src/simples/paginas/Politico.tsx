import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ANOS_ELEICAO, consultas, type Candidatura } from '../../api'
import { Retrato } from '../../componentes/Retrato'
import { cargo, cargoPlural, decimal, inteiro, nomeProprio, plural, reais } from '../../lib/formato'
import { corVies } from '../cores'
import { BarrasH } from '../graficos'
import { Carregando, Erro, Fatos, Secao, tabela, td, th, Trilha } from '../ui'

const resultado = (c: Candidatura) => (c.eleito ? (c.reeleito ? 'Reeleito' : 'Eleito') : 'Não eleito')

/** As 16 eleições de 1994 a 2024 numa régua: cada casa é uma eleição, cheia quando venceu. */
function Trajetoria({ candidaturas }: { candidaturas: Candidatura[] }) {
  const anos = [...ANOS_ELEICAO].reverse()
  return (
    <div className="overflow-x-auto pb-2">
      <ol className="grid min-w-[720px] gap-1" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
        {anos.map((a) => {
          const doAno = candidaturas.filter((c) => c.ano === a)
          const venceu = doAno.some((c) => c.eleito)
          return (
            <li key={a} className="flex flex-col items-center gap-1.5 text-center">
              <span
                className={`grid h-9 w-full place-items-center rounded-[4px] border text-[0.7rem] font-bold ${
                  doAno.length === 0 ? 'border-dashed border-linha text-transparent' : venceu ? 'border-eleito bg-eleito text-folha' : 'border-linha-2 bg-folha text-tinta-2'
                }`}
                title={doAno.map((c) => `${cargo(c.cargo)}: ${resultado(c)}`).join('; ') || 'Não concorreu'}
              >
                {doAno.length > 0 && (venceu ? 'eleito' : 'não')}
              </span>
              <span className="text-[0.72rem] tabular-nums text-tinta-3">’{String(a).slice(2)}</span>
              <span className="text-[0.7rem] leading-tight text-tinta-2">{doAno.map((c) => cargo(c.cargo).split(' ')[0]).join(', ')}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function Politico() {
  const { id } = useParams({ strict: false }) as { id: string }
  const { data: p, error } = useQuery(consultas.politico(Number(id)))

  if (error) return <Erro erro={error} />
  if (!p) return <Carregando />

  const r = p.resumo
  const ctx = p.contexto_reeleicao
  const candidaturas = p.candidaturas.toSorted((a, b) => b.ano - a.ano)
  const foto = p.foto ?? candidaturas.find((c) => c.foto)?.foto ?? null
  const comVotos = candidaturas.filter((c) => c.votos != null && c.votos > 0)
  const maior = comVotos.toSorted((a, b) => b.votos! - a.votos!)[0]
  const partidos = [...new Set(candidaturas.map((c) => c.partido).filter(Boolean))]

  return (
    <>
      <Trilha itens={[{ rotulo: 'Políticos', para: <Link to="/urna" className="text-acao hover:underline">Políticos</Link> }, { rotulo: nomeProprio(p.nome) }]} />
      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end">
        <Retrato foto={foto} nome={p.nome} tamanho={132} className="!rounded-xl shadow-cartao" />
        <div className="min-w-0">
          <h1 className="text-[2rem] font-[780] leading-[1.05] tracking-[-0.02em] [text-wrap:balance] sm:text-[2.6rem]">{nomeProprio(p.nome)}</h1>
          <p className="mt-3 text-[1.05rem] text-tinta-2">
            {p.ufs.join(', ')}
            {p.nascimento_ano && ` · nascido em ${p.nascimento_ano}`}
            {partidos.length > 0 && ` · ${partidos.join(', ')}`}
          </p>
        </div>
      </div>

      <Fatos
        itens={[
          { rotulo: 'Candidaturas', valor: inteiro(r.candidaturas), detalhe: r.primeiro_ano != null ? `de ${r.primeiro_ano} a ${r.ultimo_ano}` : undefined },
          { rotulo: 'Vitórias', valor: inteiro(r.vitorias), detalhe: `${plural(r.derrotas, 'derrota', 'derrotas')}` },
          { rotulo: 'Reeleições', valor: inteiro(r.reeleicoes) },
          { rotulo: 'Maior votação', valor: maior ? inteiro(maior.votos) : '-', detalhe: maior ? `${cargo(maior.cargo)}, ${maior.ano}` : 'sem votos registrados' },
        ]}
      />

      <Secao
        titulo="Trajetória"
        nota={
          ctx
            ? `Para comparar: dos ${inteiro(ctx.tentaram)} ${cargoPlural(ctx.cargo)} ${ctx.uf === 'BR' ? 'do país' : `de ${ctx.uf}`} que tentaram a reeleição, ${inteiro(ctx.reeleitos)} ${ctx.reeleitos === 1 ? 'conseguiu' : 'conseguiram'} (${decimal(ctx.taxa, 0)}%).`
            : 'Uma casa por eleição, de 1994 a 2024; cheia quando venceu.'
        }
      >
        <Trajetoria candidaturas={candidaturas} />
      </Secao>

      {comVotos.length > 0 && (
        <Secao titulo="Votos recebidos" nota="Só de 2018 a 2024 nos estados carregados. A cor é o viés do partido.">
          <BarrasH
            larguraRotulo="9.5rem"
            barras={comVotos.map((c, i) => ({
              chave: `${c.ano}-${i}`,
              rotulo: `${c.ano} · ${cargo(c.cargo)}`,
              valor: c.votos!,
              cor: corVies(c.vies),
              texto: `${inteiro(c.votos)}${c.eleito ? ' · eleito' : ''}`,
              dica: (
                <>
                  <strong>
                    {cargo(c.cargo)}, {c.ano}
                  </strong>
                  <br />
                  {c.local} · {c.partido ?? 'partido não informado'}
                  {c.gasto != null && (
                    <>
                      <br />
                      Gasto: {reais(c.gasto)}
                    </>
                  )}
                </>
              ),
            }))}
          />
        </Secao>
      )}

      <Secao titulo="Todas as candidaturas">
        <div className="overflow-x-auto">
          <table className={tabela}>
            <thead>
              <tr>
                <th className={th}>Ano</th>
                <th className={th}>Cargo</th>
                <th className={th}>Onde</th>
                <th className={th}>Partido</th>
                <th className={`${th} text-right`}>Votos</th>
                <th className={`${th} hidden text-right sm:table-cell`}>Gasto</th>
                <th className={th}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {candidaturas.map((c, i) => (
                <tr key={i}>
                  <td className={`${td} tabular-nums`}>{c.ano}</td>
                  <td className={td}>
                    <span className="flex items-center gap-2.5">
                      <Retrato foto={c.foto} nome={p.nome} tamanho={28} className="hidden !rounded-[5px] sm:grid" />
                      {cargo(c.cargo)}
                    </span>
                  </td>
                  <td className={td}>{c.local}</td>
                  <td className={td}>{c.partido ?? <span className="text-tinta-3">não informado</span>}</td>
                  <td className={`${td} text-right tabular-nums`}>{c.votos == null ? '-' : inteiro(c.votos)}</td>
                  <td className={`${td} hidden text-right tabular-nums sm:table-cell`}>{c.gasto == null ? '-' : reais(c.gasto)}</td>
                  <td className={`${td} ${c.eleito ? 'font-semibold text-eleito' : 'text-tinta-2'}`}>{resultado(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
    </>
  )
}
