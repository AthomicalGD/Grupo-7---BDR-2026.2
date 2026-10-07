// Custo por voto de cada eleito: gasto da campanha ÷ votos nominais do 1º turno.
// Os cinco mais caros e os cinco mais baratos, com foto; quem não declarou gasto fica fora do ranking.
import { Link } from '@tanstack/react-router'
import type { Assento } from '../api'
import { Retrato } from '../componentes/Retrato'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, nomeProprio, plural, reaisCurto } from '../lib/formato'

interface Linha extends Assento {
  porVoto: number
}

function Lista({ titulo, linhas, fator }: { titulo: string; linhas: Linha[]; fator: number }) {
  return (
    <div>
      <h3 className="t-h3">{titulo}</h3>
      <ol className="mt-3 grid gap-1">
        {linhas.map((l) => (
          <li key={l.id}>
            <Link
              to="/politico/$id"
              params={{ id: String(l.id) }}
              className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-folha"
            >
              <Retrato foto={l.foto} nome={l.nome} tamanho={40} />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{nomeProprio(l.nome)}</span>
                <span className="block truncate text-[0.8rem] text-tinta-3">
                  {[l.partido, l.local ?? l.uf].filter(Boolean).join(' · ')} · {reaisCurto(l.gasto * fator)} ÷ {inteiro(l.votos)} votos
                </span>
              </span>
              <span className="text-right">
                <span className="t-numero block text-[1.35rem]">{reaisCurto(l.porVoto)}</span>
                <span className="block text-[0.72rem] text-tinta-3">por voto</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function CustoVoto({ cadeiras, fator }: { cadeiras: Assento[]; fator: number }) {
  const linhas = cadeiras
    .filter((a) => a.votos > 0 && a.gasto > 0)
    .map((a) => ({ ...a, porVoto: (a.gasto * fator) / a.votos }))
    .sort((a, b) => b.porVoto - a.porVoto)
  const semGasto = cadeiras.filter((a) => a.gasto <= 0).length
  if (!linhas.length) return <p className="text-tinta-2">Nenhum eleito com gasto e votos declarados nesta seleção.</p>
  const meio = linhas[Math.floor(linhas.length / 2)].porVoto
  const n = Math.min(5, Math.floor(linhas.length / 2))
  return (
    <div>
      <p className="max-w-[62ch] text-[1.02rem] text-tinta-2">
        Na mediana, cada voto de um eleito custou <b className="tabular text-tinta">{reaisCurto(meio)}</b>
        {linhas.length > 1 && (
          <>
            . O mais caro pagou <b className="tabular text-tinta">{reaisCurto(linhas[0].porVoto)}</b>, o mais barato{' '}
            <b className="tabular text-tinta">{reaisCurto(linhas[linhas.length - 1].porVoto)}</b>
          </>
        )}
        .{semGasto > 0 && ` ${plural(semGasto, 'eleito não declarou', 'eleitos não declararam')} gasto e ficou de fora.`}
      </p>
      {n >= 2 && (
        <div className="mt-8 grid gap-10 md:grid-cols-2">
          <Lista titulo="Voto mais caro" linhas={linhas.slice(0, n)} fator={fator} />
          <Lista titulo="Voto mais barato" linhas={linhas.slice(-n).reverse()} fator={fator} />
        </div>
      )}
      <TabelaAlternavel
        titulo="Custo por voto de cada eleito"
        colunas={['Eleito', 'Partido', 'Gasto', 'Votos', 'Por voto']}
        linhas={linhas.map((l) => [nomeProprio(l.nome), l.partido ?? '-', reaisCurto(l.gasto * fator), inteiro(l.votos), reaisCurto(l.porVoto)])}
      />
    </div>
  )
}
