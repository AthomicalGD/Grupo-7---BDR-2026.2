import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ANOS, consultas } from '../../api'
import { vies as fmtVies } from '../../lib/formato'
import { ladoVies } from '../../lib/vies'
import { LinhaVies } from '../graficos'
import { BuscaMunicipio, Carregando, Erro, Secao, tabela, td, th, Titulo, VerTabela, Vies } from '../ui'

export function Inicio() {
  const { data: ufs, error } = useQuery(consultas.ufs())
  const carregadas = (ufs?.filter((u) => u.carregada) ?? []).toSorted((a, b) => (a.vies[2022] ?? 0) - (b.vies[2022] ?? 0))
  const faltam = ufs?.filter((u) => !u.carregada) ?? []
  const [maisEsq, maisDir] = [carregadas.at(0), carregadas.at(-1)]
  const todosEsquerda = carregadas.length > 0 && carregadas.every((u) => ANOS.every((a) => (u.vies[a] ?? 0) < 0))

  return (
    <>
      <Titulo sub="Viés partidário de cada estado e município de 2018 a 2024, de −100 (esquerda) a +100 (direita), calculado com os votos válidos de todos os cargos.">
        Para onde o voto pendeu
      </Titulo>

      <div className="max-w-xl">
        <BuscaMunicipio />
      </div>

      <Secao
        titulo="Os estados, eleição a eleição"
        nota={
          maisEsq && maisDir ? (
            <>
              Em 2022, {maisEsq.nome} foi o mais à esquerda ({fmtVies(maisEsq.vies[2022])}) e {maisDir.nome} o{' '}
              {(maisDir.vies[2022] ?? 0) < 0 ? 'menos à esquerda' : 'mais à direita'} ({fmtVies(maisDir.vies[2022])}).
              {todosEsquerda && ' Todos os estados carregados pendem à esquerda nas quatro eleições.'}
            </>
          ) : undefined
        }
      >
        {error ? (
          <Erro erro={error} />
        ) : !ufs ? (
          <Carregando />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {carregadas.map((u) => (
                <li key={u.sigla}>
                  <Link to="/uf/$sigla" params={{ sigla: u.sigla }} className="group block rounded-lg">
                    <div className="flex items-baseline justify-between gap-2 border-b border-linha pb-1.5">
                      <span className="truncate font-semibold text-tinta group-hover:text-acao group-hover:underline">{u.nome}</span>
                      <span className="text-[1.15rem] font-bold tabular-nums">
                        {fmtVies(u.vies[2022])}
                      </span>
                    </div>
                    <LinhaVies series={[{ nome: u.nome, valores: u.vies }]} altura={110} mini />
                    <p className="text-[0.8rem] text-tinta-3">{ladoVies(u.vies[2022])} em 2022</p>
                  </Link>
                </li>
              ))}
            </ul>

            <VerTabela>
              <table className={tabela}>
                <thead>
                  <tr>
                    <th className={th}>Estado</th>
                    {ANOS.map((a) => (
                      <th key={a} className={`${th} text-right`}>
                        {a}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {carregadas.map((u) => (
                    <tr key={u.sigla}>
                      <td className={td}>{u.nome}</td>
                      {ANOS.map((a) => (
                        <td key={a} className={`${td} text-right`}>
                          <Vies valor={u.vies[a]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </VerTabela>

            {faltam.length > 0 && (
              <p className="mt-6 text-[0.9rem] text-tinta-2">
                <span className="font-semibold text-tinta">Sem dados carregados:</span> {faltam.map((u) => u.sigla).join(', ')}.
              </p>
            )}
          </>
        )}
      </Secao>
    </>
  )
}
