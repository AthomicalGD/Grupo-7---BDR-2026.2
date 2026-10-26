// As zonas eleitorais do município no boletim: onde se vota, quantos votam em cada zona e quem levou a zona.
// A seção de cada eleitor não está nos dados abertos do TSE: o link leva à consulta oficial pelo nome ou título.
import { ArrowSquareOut } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { consultas } from '../api'
import { inteiro, nomeProprio, pct } from '../lib/formato'

const TSE_LOCAL = 'https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/atendimento-eleitor/onde-votar'

export function Zonas({ ibge, ano }: { ibge: number; ano: number }) {
  const q = useQuery(consultas.zonas(ibge, ano))
  const d = q.data
  if (q.isError) return <p className="text-[0.88rem] text-tinta-3">Não foi possível abrir as zonas deste município.</p>
  if (!d) return <p className="text-[0.88rem] text-tinta-3" role="status">Contando as zonas...</p>
  if (!d.zonas.length) return <p className="text-[0.88rem] text-tinta-3">Sem zonas eleitorais carregadas para {ano}.</p>
  return (
    <div>
      <p className="text-[0.9rem] text-tinta-2">
        {d.zonas.length === 1 ? 'Uma zona eleitoral' : `${inteiro(d.zonas.length)} zonas eleitorais`} em {ano}. Na última coluna, quem teve mais votos para {d.cargo.toLowerCase()} na zona, no 1º turno.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[0.84rem] tabular">
          <caption className="sr-only">Zonas eleitorais em {ano}</caption>
          <thead>
            <tr className="t-mono text-left text-[0.75rem] uppercase tracking-[0.04em] text-tinta-3">
              <th scope="col" className="py-1.5 pr-3 font-semibold">Zona</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Aptos</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Foram</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Superior</th>
              <th scope="col" className="py-1.5 font-semibold">Mais votado</th>
            </tr>
          </thead>
          <tbody>
            {d.zonas.map((z) => (
              <tr key={z.numero} className="border-t border-dashed border-linha-2">
                <th scope="row" className="py-1.5 pr-3 text-left font-bold">{z.numero}ª</th>
                <td className="py-1.5 pr-3 text-right">{inteiro(z.aptos)}</td>
                <td className="py-1.5 pr-3 text-right">{z.aptos && z.foram != null ? pct((100 * z.foram) / z.aptos, 0) : '-'}</td>
                <td className="py-1.5 pr-3 text-right">{z.foram && z.superior != null ? pct((100 * z.superior) / z.foram, 0) : '-'}</td>
                <td className="py-1.5">
                  {z.id_politico && z.nm_urna ? (
                    <Link to="/politico/$id" params={{ id: String(z.id_politico) }} className="font-semibold text-acao hover:underline">
                      {nomeProprio(z.nm_urna)}
                    </Link>
                  ) : '-'}
                  {z.sigla && <span className="text-tinta-3"> {z.sigla}</span>}
                  {z.votos != null && z.total ? <span className="text-tinta-3"> · {pct((100 * z.votos) / z.total, 0)}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <a href={TSE_LOCAL} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-acao hover:underline">
        Achar a sua seção e o local de votação no TSE <ArrowSquareOut size={14} weight="bold" aria-hidden />
      </a>
    </div>
  )
}
