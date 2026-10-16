// A cadeira do plenário em miniatura, a mesma do sistema, para a câmara eleita no boletim da Escola.

/** A cadeira do plenário vista de cima (encosto em tinta, assento na cor), em unidades do diâmetro. */
export function Cadeira({ fundo, contorno }: { fundo: string; contorno?: string }) {
  return (
    <>
      <rect x={-0.44} y={-0.5} width={0.88} height={0.22} rx={0.08} fill="var(--color-tinta)" opacity={0.82} />
      <rect
        x={-0.37} y={-0.24} width={0.74} height={0.62} rx={0.15}
        fill={fundo} stroke={contorno ?? 'var(--color-tinta)'} strokeOpacity={contorno ? 1 : 0.35} strokeWidth={contorno ? 2 : 1}
        vectorEffect="non-scaling-stroke"
      />
    </>
  )
}
