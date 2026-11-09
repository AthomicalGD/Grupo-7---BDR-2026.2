import { faixasMapa, SATURA } from '../lib/vies'
import { SATURA_RELATIVO, SATURA_UF } from './valores'

/** `brasil`: o mapa mostra os estados (escala de ±40); dentro de um estado, os municípios (±75). */
export function Legenda({ relativo = false, brasil = false, semDados = 'Sem dados carregados' }: { relativo?: boolean; brasil?: boolean; semDados?: string }) {
  const satura = relativo ? SATURA_RELATIVO : brasil ? SATURA_UF : SATURA
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-2 text-[0.78rem] text-tinta-2">
      <div className="w-[min(340px,100%)]">
        <div className="h-2.5 rounded-full" style={{ background: faixasMapa(satura) }} />
        <div className="mt-1.5 flex justify-between font-semibold">
          <span>
            <span className="tabular">−{satura}</span> {relativo ? 'mais à esquerda que o estado' : 'Esquerda'}
          </span>
          <span className="tabular">0</span>
          <span>
            {relativo ? 'mais à direita' : 'Direita'} <span className="tabular">+{satura}</span>
          </span>
        </div>
      </div>
      {!relativo && (
        <div className="flex items-center gap-2 font-semibold">
          <svg width="26" height="12" aria-hidden className="rounded-[3px] border border-linha-2">
            <rect width="26" height="12" fill="url(#hachura-legenda)" />
            <defs>
              <pattern id="hachura-legenda" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
                <rect width="5" height="5" fill="var(--color-neutro)" />
                <line x1="0" y1="0" x2="0" y2="5" stroke="var(--color-linha-2)" strokeWidth="1.6" />
              </pattern>
            </defs>
          </svg>
          {semDados}
        </div>
      )}
    </div>
  )
}
