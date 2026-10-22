import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { consultas } from '../../api'
import { cargoPlural, decimal, vies as fmtVies, inteiro } from '../../lib/formato'
import { corVies, ESCALA_ESCOLA } from '../cores'
import { BarrasH, Composicao } from '../graficos'
import { Carregando, Erro, Opcoes, Secao, tabela, td, th, Titulo, VerTabela } from '../ui'

const ANOS = [
  { valor: 2022, rotulo: '2022, geral' },
  { valor: 2024, rotulo: '2024, municipal' },
]

const soma = (v: number[]) => v.reduce((a, b) => a + b, 0)
/** O último dos 8 graus é o superior completo. */
const superior = (v: number[]) => v[7] ?? 0
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function Escola() {
  const busca = useSearch({ strict: false }) as { ano?: number; uf?: string }
  const navegar = useNavigate()
  const ano = busca.ano === 2024 ? 2024 : 2022
  const uf = busca.uf ?? ''
  const mudar = (m: { ano?: number; uf?: string }) =>
    navegar({ to: '/escola', search: { ano: ano as 2022 | 2024, uf: uf || undefined, ...m } as never, replace: true })

  const { data: ufs } = useQuery(consultas.ufs())
  const { data, error, isPlaceholderData } = useQuery({ ...consultas.escola(ano, uf), placeholderData: keepPreviousData })
  const { data: partidos } = useQuery({ ...consultas.escolaPartidos(ano, uf), placeholderData: keepPreviousData })
  const opcoesUF = [{ valor: '', rotulo: 'Todos' }, ...(ufs?.filter((u) => u.carregada).map((u) => ({ valor: u.sigla, rotulo: u.sigla })) ?? [])]

  const linhas = data
    ? [
        { grupo: 'Quem votou', graus: data.votantes, forte: true },
        ...data.cargos.flatMap((c) => [
          { grupo: `Candidatos a ${cargoPlural(c.nome)}`, graus: c.candidatos, forte: false },
          { grupo: `Eleitos ${cargoPlural(c.nome)}`, graus: c.eleitos, forte: false },
        ]),
      ].map((l) => ({ ...l, total: soma(l.graus), sup: superior(l.graus), p: soma(l.graus) ? (superior(l.graus) / soma(l.graus)) * 100 : null }))
    : []
  const votou = linhas[0]
  const eleitos = data ? data.cargos.reduce((a, c) => a + superior(c.eleitos), 0) / (data.cargos.reduce((a, c) => a + soma(c.eleitos), 0) || 1) * 100 : null
  const rotulos = data?.niveis.map((n) => n.rotulo) ?? []
  const comEleitos = (partidos ?? []).filter((p) => p.eleitos >= 3).toSorted((a, b) => (a.vies ?? 0) - (b.vies ?? 0))

  return (
    <>
      <Titulo
        sub={
          <>
            <p>Escolaridade declarada ao TSE por quem se candidatou e se elegeu, comparada com a de quem foi votar.</p>
            {votou?.p != null && eleitos != null && votou.p > 0 && (
              <p className="mt-5 flex items-baseline gap-3 text-tinta">
                <strong className="text-[2.6rem] font-[800] leading-none tabular-nums">{decimal(eleitos / votou.p, 0)}×</strong>
                <span className="text-[1.05rem]">
                  mais diploma entre quem se elegeu ({decimal(eleitos, 0)} de 100) do que entre quem votou ({decimal(votou.p, 0)} de 100).
                </span>
              </p>
            )}
          </>
        }
      >
        Quanto estudou quem senta na cadeira
      </Titulo>

      <div className="flex flex-wrap gap-x-8 gap-y-5 rounded-xl bg-papel p-5">
        <Opcoes rotulo="Eleição" valor={ano} opcoes={ANOS} aoMudar={(v) => mudar({ ano: v })} />
        <Opcoes rotulo="Estado" valor={uf} opcoes={opcoesUF} aoMudar={(v) => mudar({ uf: v || undefined })} />
      </div>

      {error ? (
        <Erro erro={error} />
      ) : !data ? (
        <Carregando />
      ) : (
        <div className={`transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <Secao titulo="Do eleitor ao eleito" nota="Cada barra é um grupo dividido pelos 8 graus de escolaridade; o número é quantos de cada 100 têm superior completo.">
            <ul className="mb-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.82rem] text-tinta-2">
              {rotulos.map((r, i) => (
                <li key={r} className="flex items-center gap-1.5">
                  <span aria-hidden className="h-3 w-3 rounded-[2px] ring-1 ring-tinta/15" style={{ background: ESCALA_ESCOLA[i] }} />
                  {r}
                </li>
              ))}
            </ul>
            <ul className="space-y-4">
              {linhas.map((l) => (
                <li key={l.grupo} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[14rem_1fr_3.5rem]">
                  <span className={`text-[0.92rem] ${l.forte ? 'font-bold' : ''}`}>{maiuscula(l.grupo)}</span>
                  <Composicao partes={l.graus} cores={ESCALA_ESCOLA} rotulos={rotulos} altura={l.forte ? 26 : 20} />
                  <span className="text-[1.1rem] font-bold tabular-nums sm:text-right">{l.p == null ? '-' : decimal(l.p, 0)}</span>
                </li>
              ))}
            </ul>

            <VerTabela>
              <table className={tabela}>
                <thead>
                  <tr>
                    <th className={th}>Grupo</th>
                    <th className={`${th} text-right`}>Total</th>
                    <th className={`${th} text-right`}>Com superior</th>
                    <th className={`${th} text-right`}>De cada 100</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.grupo}>
                      <td className={`${td} ${l.forte ? 'font-semibold' : ''}`}>{maiuscula(l.grupo)}</td>
                      <td className={`${td} text-right tabular-nums`}>{inteiro(l.total)}</td>
                      <td className={`${td} text-right tabular-nums`}>{inteiro(l.sup)}</td>
                      <td className={`${td} text-right tabular-nums`}>{l.p == null ? '-' : decimal(l.p, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </VerTabela>
          </Secao>

          {comEleitos.length > 1 && (
            <Secao
              titulo="Diploma por partido"
              nota="Quantos de cada 100 eleitos do partido têm superior completo, da esquerda para a direita. Só partidos com 3 eleitos ou mais."
            >
              <BarrasH
                larguraRotulo="6rem"
                barras={comEleitos.map((p) => ({
                  chave: p.sigla,
                  rotulo: p.sigla,
                  valor: (p.eleitos_superior / p.eleitos) * 100,
                  cor: corVies(p.vies),
                  texto: `${decimal((p.eleitos_superior / p.eleitos) * 100, 0)} · ${inteiro(p.eleitos)} eleitos`,
                  dica: (
                    <>
                      <strong>{p.nome}</strong> · viés {fmtVies(p.vies)}
                      <br />
                      Candidatos com superior: {decimal((p.candidatos_superior / (p.candidatos || 1)) * 100, 0)} de 100
                    </>
                  ),
                }))}
              />
            </Secao>
          )}

          <p className="mt-8 text-[0.9rem] text-tinta-2">
            {data.ufs.join(', ')}. Quem votou: comparecimento do 1º turno. Candidaturas aptas.
          </p>
        </div>
      )}
    </>
  )
}
