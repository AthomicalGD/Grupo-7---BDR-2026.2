import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { consultas, type ContaReeleicao } from '../../api'
import { inteiro, noEstado, pct } from '../../lib/formato'
import { BarrasH, Composicao } from '../graficos'
import { Carregando, Erro, Opcoes, Secao, tabela, td, th, Titulo, VerTabela } from '../ui'

const CORES = ['var(--color-reeleito)', 'var(--color-linha-2)', 'var(--color-papel-2)']
const ROTULOS = ['Voltaram', 'Tentaram e perderam', 'Não tentaram']
const partes = (c: ContaReeleicao) => [c.reeleitos, c.tentaram - c.reeleitos, c.eleitos - c.tentaram]
const taxa = (c: ContaReeleicao) => (c.taxa == null ? 'ninguém tentou' : `${pct(c.taxa)} · ${inteiro(c.reeleitos)} de ${inteiro(c.tentaram)}`)

export function Reeleicao() {
  const busca = useSearch({ strict: false }) as { uf?: string; cargo?: number }
  const navegar = useNavigate()
  const { data: ufs } = useQuery(consultas.ufs())
  const carregadas = ufs?.filter((u) => u.carregada && u.sigla !== 'BR') ?? []
  const uf = carregadas.find((u) => u.sigla === busca.uf) ?? carregadas.find((u) => u.sigla === 'PI') ?? carregadas[0]
  const { data, error, isPlaceholderData } = useQuery({ ...consultas.reeleicao(uf?.sigla ?? ''), enabled: !!uf, placeholderData: keepPreviousData })
  const cargo = data?.cargos.find((c) => c.cod === busca.cargo) ?? data?.cargos[0]
  const mudar = (m: { uf?: string; cargo?: number }) =>
    navegar({ to: '/reeleicao', search: { uf: uf?.sigla, cargo: cargo?.cod, ...m } as never, replace: true })
  const estados = useQueries({ queries: carregadas.map((u) => consultas.reeleicao(u.sigla)) })

  return (
    <>
      <Titulo sub="Dos eleitos em cada eleição, quantos disputaram o mesmo cargo, no mesmo lugar, na eleição seguinte (senador, oito anos depois), e quantos venceram de novo.">
        Quem tenta a reeleição, volta?
      </Titulo>

      <div className="rounded-xl bg-papel p-5">
        <Opcoes rotulo="Estado" valor={uf?.sigla ?? ''} opcoes={carregadas.map((u) => ({ valor: u.sigla, rotulo: u.sigla }))} aoMudar={(v) => mudar({ uf: v })} />
      </div>

      {error ? (
        <Erro erro={error} />
      ) : !data || !cargo || !uf ? (
        <Carregando />
      ) : (
        <div className={`transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <Secao
            titulo={`Por cargo, ${noEstado(uf.sigla, uf.nome)}`}
            nota="A barra são todos os eleitos do cargo, de 1994 a 2020: os que voltaram, os que tentaram e perderam e os que não tentaram. O número é a taxa de reeleição: dos que tentaram, quantos voltaram."
          >
            <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-[0.88rem] text-tinta-2">
              {ROTULOS.map((r, i) => (
                <span key={r} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-3 rounded-[3px]" style={{ background: CORES[i] }} />
                  {r}
                </span>
              ))}
            </div>
            <ul className="space-y-4">
              {data.cargos.map((c) => (
                <li key={c.cod}>
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="font-semibold">{c.nome}</span>
                    <span className="text-[0.9rem] tabular-nums text-tinta-2">
                      <strong className="text-tinta">{c.total.taxa == null ? '-' : pct(c.total.taxa)}</strong> · {inteiro(c.total.reeleitos)} de {inteiro(c.total.tentaram)} que tentaram ({inteiro(c.total.eleitos)} eleitos)
                    </span>
                  </div>
                  <Composicao partes={partes(c.total)} cores={CORES} rotulos={ROTULOS} altura={18} />
                </li>
              ))}
            </ul>
          </Secao>

          <Secao titulo="Eleição a eleição" nota="Taxa de reeleição dos eleitos em cada ano: dos que tentaram na eleição seguinte, quantos voltaram.">
            <div className="mb-5">
              <Opcoes rotulo="Cargo" valor={cargo.cod} opcoes={data.cargos.map((c) => ({ valor: c.cod, rotulo: c.nome }))} aoMudar={(v) => mudar({ cargo: v })} />
            </div>
            <BarrasH
              larguraRotulo="7.5rem"
              barras={cargo.ciclos.map((c) => ({
                chave: String(c.eleitos_em),
                rotulo: `${c.eleitos_em} → ${c.disputa}`,
                valor: c.taxa ?? 0,
                cor: 'var(--color-reeleito)',
                texto: taxa(c),
              }))}
            />
            <VerTabela>
              <table className={tabela}>
                <thead>
                  <tr>
                    <th className={th}>Eleitos em</th>
                    <th className={th}>Disputa</th>
                    <th className={`${th} text-right`}>Eleitos</th>
                    <th className={`${th} text-right`}>Tentaram</th>
                    <th className={`${th} text-right`}>Reeleitos</th>
                    <th className={`${th} text-right`}>Taxa</th>
                    {cargo.municipal && <th className={`${th} text-right`}>Média municípios</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...cargo.ciclos.map((c) => ({ ...c, rot: String(c.eleitos_em), disputa: String(c.disputa) })), { ...cargo.total, rot: 'Total', disputa: '' }].map((c) => (
                    <tr key={c.rot}>
                      <td className={`${td} font-semibold`}>{c.rot}</td>
                      <td className={td}>{c.disputa}</td>
                      <td className={`${td} text-right tabular-nums`}>{inteiro(c.eleitos)}</td>
                      <td className={`${td} text-right tabular-nums`}>{inteiro(c.tentaram)}</td>
                      <td className={`${td} text-right tabular-nums`}>{inteiro(c.reeleitos)}</td>
                      <td className={`${td} text-right tabular-nums`}>{pct(c.taxa)}</td>
                      {cargo.municipal && <td className={`${td} text-right tabular-nums`}>{pct(c.media_municipios)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </VerTabela>
          </Secao>

          <Secao titulo={`${cargo.nome}, estado a estado`} nota="A taxa somando todas as eleições, nos estados carregados no banco.">
            <BarrasH
              larguraRotulo="3rem"
              barras={carregadas.map((u, i) => {
                const t = estados[i].data?.cargos.find((c) => c.cod === cargo.cod)?.total
                return { chave: u.sigla, rotulo: u.sigla, valor: t?.taxa ?? 0, cor: 'var(--color-reeleito)', texto: estados[i].isPending ? 'contando...' : t ? taxa(t) : '-' }
              })}
            />
          </Secao>

          <p className="mt-10 text-[0.88rem] text-tinta-2">
            Ficam de fora eleições suplementares, presidente e vices e suplentes. Em 1994 e 1996, quem não tem título eleitoral é ligado pelo nome ou pela data de nascimento ({inteiro(data.ligados_por_nome)} tentativas {noEstado(uf.sigla, uf.nome)}).
          </p>
        </div>
      )}
    </>
  )
}
