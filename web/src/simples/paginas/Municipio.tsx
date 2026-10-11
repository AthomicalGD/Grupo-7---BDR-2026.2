import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { ANOS, consultas, type Ano } from '../../api'
import { Retrato } from '../../componentes/Retrato'
import { cargo, decimal, vies as fmtVies, inteiro, nomeProprio, pct, reais, reaisCurto } from '../../lib/formato'
import { ladoVies } from '../../lib/vies'
import { corVies } from '../cores'
import { BarrasH, LinhaVies } from '../graficos'
import { Carregando, Erro, Fatos, Opcoes, Secao, tabela, td, th, Titulo, Trilha } from '../ui'

export function Municipio() {
  const { sigla, ibge } = useParams({ strict: false }) as { sigla: string; ibge: string }
  const { data: m, error } = useQuery(consultas.municipio(Number(ibge)))
  const [ano, setAno] = useState<Ano | null>(null)

  if (error) return <Erro erro={error} />
  if (!m) return <Carregando />

  const anosComPartidos = ANOS.filter((a) => m.espectro[a]?.length)
  const anoPartidos = ano ?? anosComPartidos.at(-1) ?? 2024
  const partidos = (m.espectro[anoPartidos] ?? []).toSorted((a, b) => b.votos - a.votos).slice(0, 12)
  const ultimo = ANOS.findLast((a) => m.vies[a] != null)
  const ind = m.indicadores
  const comp = m.comparecimento[2022] ?? m.comparecimento[2024]
  const prefeitos = m.prefeitos.toSorted((a, b) => b.ano - a.ano)

  return (
    <>
      <Trilha
        itens={[
          { rotulo: 'Estados', para: <Link to="/" className="text-acao hover:underline">Estados</Link> },
          { rotulo: m.uf_nome, para: <Link to="/uf/$sigla" params={{ sigla }} className="text-acao hover:underline">{m.uf_nome}</Link> },
          { rotulo: m.nome },
        ]}
      />
      <Titulo
        sub={`${m.uf_nome}, região intermediária ${m.regiao_intermediaria}.`}
        lado={
          ultimo && (
            <div className="text-right">
              <p className="text-[2.6rem] font-[800] leading-none tabular-nums">{fmtVies(m.vies[ultimo])}</p>
              <p className="mt-1 text-[0.9rem] text-tinta-2">
                {ladoVies(m.vies[ultimo])} em {ultimo}
              </p>
            </div>
          )
        }
      >
        {m.nome}
      </Titulo>

      <Fatos
        itens={[
          { rotulo: 'População', valor: inteiro(ind.populacao?.valor), detalhe: ind.populacao && `IBGE, ${ind.populacao.ano}` },
          { rotulo: 'IDHM', valor: decimal(ind.idhm?.valor, 3), detalhe: ind.idhm && `Atlas Brasil, ${ind.idhm.ano}` },
          { rotulo: 'PIB por habitante', valor: reaisCurto(ind.pib_per_capita?.valor), detalhe: ind.pib_per_capita && `IBGE, ${ind.pib_per_capita.ano}` },
          {
            rotulo: 'Comparecimento',
            valor: comp ? pct((comp.comparecimento / comp.aptos) * 100) : '-',
            detalhe: comp && `${inteiro(comp.aptos)} eleitores aptos`,
          },
        ]}
      />

      <Secao titulo="Viés na linha do tempo" nota={`${m.nome} comparado com o estado. 2018 e 2022 são eleições gerais; 2020 e 2024, municipais.`}>
        <LinhaVies
          series={[
            { nome: m.uf_nome, valores: m.vies_uf },
            { nome: m.nome, valores: m.vies, destaque: true },
          ]}
        />
      </Secao>

      {anosComPartidos.length > 0 && (
        <Secao
          titulo="Partidos mais votados"
          nota="Parcela dos votos válidos. A cor é o viés do partido: vermelho à esquerda, azul à direita."
          acao={<Opcoes rotulo="Eleição" valor={anoPartidos} opcoes={anosComPartidos.map((a) => ({ valor: a, rotulo: String(a) }))} aoMudar={setAno} />}
        >
          <BarrasH
            larguraRotulo="7.5rem"
            barras={partidos.map((p) => ({
              chave: p.sigla,
              rotulo: p.sigla,
              valor: p.pct,
              cor: corVies(p.vies),
              texto: pct(p.pct),
              dica: (
                <>
                  <strong>{p.nome ?? p.sigla}</strong>
                  <br />
                  {inteiro(p.votos)} votos · viés {fmtVies(p.vies)}
                </>
              ),
            }))}
          />
        </Secao>
      )}

      {prefeitos.length > 0 && (
        <Secao titulo="Prefeitos eleitos">
          <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {prefeitos.map((p) => (
              <li key={`${p.ano}-${p.id_politico}`}>
                <Link to="/politico/$id" params={{ id: String(p.id_politico) }} className="group flex items-center gap-4 rounded-lg">
                  <Retrato foto={p.foto} nome={p.nome} tamanho={52} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-acao group-hover:underline">{nomeProprio(p.nome)}</span>
                    <span className="block text-[0.9rem] text-tinta-2">
                      {p.ano} · {p.partido}
                      {p.turno === 2 && ' · 2º turno'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {m.cadeiras.length > 0 && (
        <Secao titulo="Quanto custou cada cadeira" nota="Gasto declarado pelos candidatos dividido pelas vagas, em reais da época.">
          <div className="overflow-x-auto">
            <table className={tabela}>
              <thead>
                <tr>
                  <th className={th}>Eleição</th>
                  <th className={`${th} text-right`}>Candidatos</th>
                  <th className={`${th} text-right`}>Cadeiras</th>
                  <th className={`${th} text-right`}>Custo por cadeira</th>
                </tr>
              </thead>
              <tbody>
                {m.cadeiras.map((c) => (
                  <tr key={`${c.ano}-${c.cod_cargo}`}>
                    <td className={td}>
                      {cargo(c.cargo)}, {c.ano}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{inteiro(c.candidatos)}</td>
                    <td className={`${td} text-right tabular-nums`}>{inteiro(c.cadeiras)}</td>
                    <td className={`${td} text-right tabular-nums`}>{reais(c.custo_cadeira)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}
    </>
  )
}
