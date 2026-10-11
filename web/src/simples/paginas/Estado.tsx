import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useId, useMemo, useState } from 'react'
import { ANOS, consultas, type Ano, type MunicipioResumo } from '../../api'
import { vies as fmtVies, inteiro, semAcento } from '../../lib/formato'
import { ladoVies } from '../../lib/vies'
import { Distribuicao, LinhaVies } from '../graficos'
import { Carregando, campo, Erro, Opcoes, Secao, tabela, td, th, Titulo, Trilha, Vies } from '../ui'

const OPCOES_ANO = ANOS.map((a) => ({ valor: a, rotulo: String(a) }))

function Extremos({ titulo, lista, ano, sigla }: { titulo: string; lista: MunicipioResumo[]; ano: Ano; sigla: string }) {
  return (
    <div>
      <h3 className="mb-2 text-[0.95rem] font-semibold text-tinta-2">{titulo}</h3>
      <ol className="divide-y divide-linha border-y border-linha">
        {lista.map((m, i) => (
          <li key={m.ibge} className="flex items-center gap-3 py-2">
            <span className="w-4 text-right text-[0.85rem] tabular-nums text-tinta-3">{i + 1}</span>
            <Link to="/uf/$sigla/$ibge" params={{ sigla, ibge: String(m.ibge) }} className="min-w-0 flex-1 truncate font-semibold text-acao hover:underline">
              {m.nome}
            </Link>
            <Vies valor={m.vies[ano]} />
          </li>
        ))}
      </ol>
    </div>
  )
}

export function Estado() {
  const { sigla } = useParams({ strict: false }) as { sigla: string }
  const navegar = useNavigate()
  const { data: uf, error } = useQuery(consultas.uf(sigla))
  const [ano, setAno] = useState<Ano>(2022)
  const [filtro, setFiltro] = useState('')
  const id = useId()
  const municipios = useMemo(() => {
    const f = semAcento(filtro.trim())
    const lista = uf?.municipios ?? []
    return (f ? lista.filter((m) => semAcento(m.nome).includes(f)) : lista).toSorted((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [uf, filtro])

  if (error) return <Erro erro={error} />
  if (!uf) return <Carregando />

  const comValor = uf.municipios.filter((m) => m.vies[ano] != null).toSorted((a, b) => a.vies[ano]! - b.vies[ano]!)
  const ultimo = ANOS.findLast((a) => uf.vies[a] != null)

  return (
    <>
      <Trilha itens={[{ rotulo: 'Estados', para: <Link to="/" className="text-acao hover:underline">Estados</Link> }, { rotulo: uf.nome }]} />
      <Titulo
        sub={`${inteiro(uf.municipios.length)} municípios, região ${uf.regiao}.`}
        lado={
          ultimo && (
            <div className="text-right">
              <p className="text-[2.6rem] font-[800] leading-none tabular-nums">{fmtVies(uf.vies[ultimo])}</p>
              <p className="mt-1 text-[0.9rem] text-tinta-2">
                {ladoVies(uf.vies[ultimo])} em {ultimo}
              </p>
            </div>
          )
        }
      >
        {uf.nome}
      </Titulo>

      <LinhaVies series={[{ nome: uf.nome, valores: uf.vies, destaque: true }]} />
      <p className="mt-2 text-[0.9rem] text-tinta-2">2018 e 2022 são eleições gerais; 2020 e 2024, municipais. Compare anos do mesmo tipo.</p>

      <Secao
        titulo="Como os municípios se espalham"
        nota={`Cada ponto é um município, na faixa do seu viés em ${ano}. Clique num ponto para abrir o município.`}
        acao={<Opcoes rotulo="Eleição" valor={ano} opcoes={OPCOES_ANO} aoMudar={setAno} />}
      >
        <Distribuicao
          pontos={comValor.map((m) => ({ id: m.ibge, nome: m.nome, v: m.vies[ano]! }))}
          aoEscolher={(p) => navegar({ to: '/uf/$sigla/$ibge', params: { sigla, ibge: String(p.id) } })}
        />
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <Extremos titulo="Mais à esquerda" lista={comValor.slice(0, 5)} ano={ano} sigla={sigla} />
          <Extremos titulo="Mais à direita" lista={comValor.slice(-5).reverse()} ano={ano} sigla={sigla} />
        </div>
      </Secao>

      {uf.regioes.length > 0 && (
        <Secao titulo="Regiões do estado" nota={`Regiões intermediárias do IBGE, em ${ano}.`}>
          <ul className="divide-y divide-linha border-y border-linha">
            {uf.regioes
              .toSorted((a, b) => (a.vies[ano] ?? 0) - (b.vies[ano] ?? 0))
              .map((r) => (
                <li key={r.nome} className="flex items-center justify-between gap-4 py-2">
                  <span>{r.nome}</span>
                  <Vies valor={r.vies[ano]} />
                </li>
              ))}
          </ul>
        </Secao>
      )}

      <Secao titulo="Todos os municípios">
        <label htmlFor={id} className="mb-1.5 block text-[0.85rem] font-semibold text-tinta-2">
          Filtrar pelo nome
        </label>
        <input id={id} className={`${campo} mb-4 sm:max-w-sm`} value={filtro} onChange={(e) => setFiltro(e.target.value)} autoComplete="off" />
        <div className="max-h-[560px] overflow-auto">
          <table className={tabela}>
            <thead className="sticky top-0 bg-folha">
              <tr>
                <th className={th}>Município</th>
                {ANOS.map((a) => (
                  <th key={a} className={`${th} text-right`}>
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {municipios.map((m) => (
                <tr key={m.ibge}>
                  <td className={td}>
                    <Link to="/uf/$sigla/$ibge" params={{ sigla, ibge: String(m.ibge) }} className="font-semibold text-acao hover:underline">
                      {m.nome}
                    </Link>
                  </td>
                  {ANOS.map((a) => (
                    <td key={a} className={`${td} text-right`}>
                      <Vies valor={m.vies[a]} regua={false} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {municipios.length === 0 && <p className="py-4 text-tinta-2">Nenhum município com esse nome.</p>}
      </Secao>
    </>
  )
}
