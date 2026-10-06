import { CaretRight } from '@phosphor-icons/react'
import { Link, useParams } from '@tanstack/react-router'

/** Trilha Brasil / estado / município, mantendo o ano e a escala escolhidos. */
export function Trilha({ uf, municipio }: { uf?: string; municipio?: string }) {
  const { sigla } = useParams({ strict: false }) as { sigla?: string }
  const link = 'font-semibold text-acao underline-offset-4 hover:underline'
  return (
    <nav aria-label="Você está em" className="text-[0.88rem]">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link to="/" search={(s) => s} className={link}>Brasil</Link>
        </li>
        {uf && (
          <li className="flex items-center gap-1.5">
            <CaretRight size={12} className="text-tinta-3" aria-hidden />
            {municipio && sigla ? (
              <Link to="/uf/$sigla" params={{ sigla }} search={(s) => s} className={link}>{uf}</Link>
            ) : (
              <span aria-current="page" className="font-semibold">{uf}</span>
            )}
          </li>
        )}
        {municipio && (
          <li className="flex items-center gap-1.5">
            <CaretRight size={12} className="text-tinta-3" aria-hidden />
            <span aria-current="page" className="font-semibold">{municipio}</span>
          </li>
        )}
      </ol>
    </nav>
  )
}
