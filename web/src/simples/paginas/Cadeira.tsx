import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { CARGOS_P1, consultas } from '../../api'
import { escalaGasto, MINIMO } from '../../cadeira/geometria'
import { Retrato } from '../../componentes/Retrato'
import { vies as fmtVies, inteiro, nomeProprio, pct, reais, reaisCurto } from '../../lib/formato'
import { corGasto, corVies } from '../cores'
import { BarrasH, Colunas } from '../graficos'
import { Carregando, Erro, Fatos, Opcoes, Secao, tabela, td, th, Titulo, VerTabela } from '../ui'

// Só os cargos das eleições gerais: prefeito e vereador têm o custo na página do município.
const CARGOS = CARGOS_P1.filter((c) => !c.municipal).map((c) => ({ valor: c.cod as number, rotulo: c.nome }))
const ANOS = [
  { valor: 2022, rotulo: '2022' },
  { valor: 2018, rotulo: '2018' },
]

export function Cadeira() {
  const busca = useSearch({ strict: false }) as { cargo?: number; ano?: number; uf?: string }
  const navegar = useNavigate()
  const cargo = CARGOS.some((c) => c.valor === busca.cargo) ? busca.cargo! : 6
  const ano = busca.ano === 2018 ? 2018 : 2022
  const uf = busca.uf ?? ''
  const mudar = (m: { cargo?: number; ano?: number; uf?: string }) =>
    navegar({ to: '/cadeira', search: { cargo, ano: ano as 2018 | 2022, uf: uf || undefined, ...m } as never, replace: true })

  const { data: ufs } = useQuery(consultas.ufs())
  const { data, error, isPlaceholderData } = useQuery({ ...consultas.cadeira(ano, cargo, uf), placeholderData: keepPreviousData })
  const f = data?.ipca[String(data.ano)] ?? 1
  const opcoesUF = [{ valor: '', rotulo: 'Todos' }, ...(ufs?.filter((u) => u.carregada).map((u) => ({ valor: u.sigla, rotulo: u.sigla })) ?? [])]
  const eleitos = data?.cadeiras.toSorted((a, b) => b.gasto - a.gasto) ?? []
  const escala = escalaGasto(eleitos.map((e) => e.gasto))
  const partidos = (data?.partidos ?? [])
    .filter((p) => p.cadeiras > 0)
    .map((p) => ({ ...p, porCadeira: p.gasto / p.cadeiras }))
    .toSorted((a, b) => b.porCadeira - a.porCadeira)
  const faixas = (data?.curva ?? []).filter((c) => c.candidatos >= MINIMO)

  return (
    <>
      <Titulo sub="Tudo o que os candidatos declararam gastar, dividido pelas vagas em disputa. Valores em reais de outubro de 2024, corrigidos pelo IPCA.">
        Quanto custa uma cadeira
      </Titulo>

      <div className="grid gap-5 rounded-xl bg-papel p-5">
        <Opcoes rotulo="Cargo" valor={cargo} opcoes={CARGOS} aoMudar={(v) => mudar({ cargo: v })} />
        <div className="flex flex-wrap gap-x-8 gap-y-5">
          <Opcoes rotulo="Eleição" valor={ano} opcoes={ANOS} aoMudar={(v) => mudar({ ano: v })} />
          <Opcoes rotulo="Estado" valor={uf} opcoes={opcoesUF} aoMudar={(v) => mudar({ uf: v || undefined })} />
        </div>
      </div>

      {error ? (
        <Erro erro={error} />
      ) : !data ? (
        <Carregando />
      ) : (
        <div className={`transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <div className="mt-10">
            <Fatos
              itens={[
                { rotulo: 'Custo por cadeira', valor: reaisCurto((data.resumo.custo_cadeira ?? 0) * f), detalhe: reais((data.resumo.custo_cadeira ?? 0) * f) },
                { rotulo: 'Gasto total', valor: reaisCurto(data.resumo.gasto_total * f), detalhe: `${inteiro(data.resumo.candidatos)} candidatos` },
                { rotulo: 'Mediana de quem venceu', valor: reaisCurto((data.resumo.mediana_eleito ?? 0) * f) },
                { rotulo: 'Mediana de quem perdeu', valor: reaisCurto((data.resumo.mediana_nao_eleito ?? 0) * f) },
              ]}
            />
          </div>

          {eleitos.length > 1 && (
            <Secao titulo={`O gasto de cada um dos ${inteiro(eleitos.length)} eleitos`} nota="Uma coluna por eleito, do maior gasto ao menor. Passe o mouse para ver quem é.">
              <Colunas
                itens={eleitos.map((e) => ({
                  chave: e.id,
                  valor: e.gasto,
                  cor: corGasto(escala.t(e.gasto)),
                  dica: (
                    <>
                      <strong>{nomeProprio(e.nome)}</strong>
                      <br />
                      {e.partido ?? 'sem partido'} · {e.uf} · {reais(e.gasto * f)}
                    </>
                  ),
                }))}
              />
              <div className="mt-1.5 flex justify-between text-[0.8rem] text-tinta-3">
                <span>maior: {reaisCurto(eleitos[0].gasto * f)}</span>
                <span>menor: {reaisCurto(eleitos.at(-1)!.gasto * f)}</span>
              </div>
            </Secao>
          )}

          <Secao titulo={eleitos.length > 1 ? 'Os que mais gastaram' : 'Quem se elegeu'}>
            <ol className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {eleitos.slice(0, 6).map((e, i) => (
                <li key={e.id}>
                  <Link to="/politico/$id" params={{ id: String(e.id) }} className="group flex items-center gap-4 rounded-lg p-1.5 hover:bg-papel">
                    <span className="w-5 text-right text-[0.9rem] font-semibold tabular-nums text-tinta-3">{i + 1}</span>
                    <Retrato foto={e.foto} nome={e.nome} tamanho={48} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-acao group-hover:underline">{nomeProprio(e.nome)}</span>
                      <span className="block text-[0.88rem] text-tinta-2">
                        {e.partido ?? '-'} · {e.uf} · {inteiro(e.votos)} votos
                      </span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">{reaisCurto(e.gasto * f)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </Secao>

          {partidos.length > 1 && (
            <Secao titulo="Custo por cadeira, por partido" nota="Gasto de todos os candidatos do partido dividido pelas cadeiras que ele ganhou. A cor é o viés do partido.">
              <BarrasH
                larguraRotulo="5.5rem"
                barras={partidos.map((p) => ({
                  chave: p.sigla,
                  rotulo: p.sigla,
                  valor: p.porCadeira,
                  cor: corVies(p.vies),
                  texto: reaisCurto(p.porCadeira * f),
                  dica: (
                    <>
                      <strong>{p.sigla}</strong> · viés {fmtVies(p.vies)}
                      <br />
                      {inteiro(p.cadeiras)} de {inteiro(p.candidatos)} candidatos eleitos
                    </>
                  ),
                }))}
              />
            </Secao>
          )}

          {faixas.length > 1 && (
            <Secao titulo="Quanto mais gasto, mais chance" nota="Parcela dos candidatos que se elegeu em cada faixa de gasto. Faixas com menos de 5 candidatos ficam de fora.">
              <BarrasH
                larguraRotulo="11.5rem"
                barras={faixas.map((c) => ({
                  chave: String(c.de),
                  rotulo: c.de === 0 ? `até ${reaisCurto(c.ate * f)}` : `${reaisCurto(c.de * f)} a ${reaisCurto(c.ate * f)}`,
                  valor: (c.eleitos / c.candidatos) * 100,
                  cor: 'var(--color-eleito)',
                  texto: `${pct((c.eleitos / c.candidatos) * 100, 0)} · ${inteiro(c.eleitos)}/${inteiro(c.candidatos)}`,
                }))}
              />
            </Secao>
          )}

          <VerTabela rotulo={`Ver todos os ${inteiro(eleitos.length)} eleitos em tabela`}>
            <table className={tabela}>
              <thead>
                <tr>
                  <th className={th}>Eleito</th>
                  <th className={th}>Partido</th>
                  <th className={th}>UF</th>
                  <th className={`${th} text-right`}>Votos</th>
                  <th className={`${th} text-right`}>Gasto</th>
                </tr>
              </thead>
              <tbody>
                {eleitos.map((e) => (
                  <tr key={e.id}>
                    <td className={td}>
                      <Link to="/politico/$id" params={{ id: String(e.id) }} className="font-semibold text-acao hover:underline">
                        {nomeProprio(e.nome)}
                      </Link>
                    </td>
                    <td className={td}>{e.partido ?? '-'}</td>
                    <td className={td}>{e.uf}</td>
                    <td className={`${td} text-right tabular-nums`}>{inteiro(e.votos)}</td>
                    <td className={`${td} text-right tabular-nums`}>{reais(e.gasto * f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </VerTabela>
        </div>
      )}
    </>
  )
}
