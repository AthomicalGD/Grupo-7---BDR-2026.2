// A assinatura da P6: a faixa etária em seis pastilhas sépia (o papel amarela com o tempo) e a régua que responde
// "jovem vota no jovem?" na mesma escala: 5 anos a mais de quem votou contra o quanto muda a idade de quem é votado.
import type { EfeitoIdade } from '../api'
import { anos, comSinal, SEPIA } from './sepia'

/** Seis pastilhas, da folha clara ao sépia escuro: o enfeite de cada pergunta da página. */
export function FaixaSepia({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex gap-[3px] ${className}`} aria-hidden>
      {SEPIA.map((c) => (
        <span key={c} className="block h-3 w-6 rounded-[3px] border-2 border-tinta" style={{ background: c }} />
      ))}
    </span>
  )
}

export function ReguaIdade({ eleitor = 5, comEscolaridade, semEscolaridade }: {
  /** quanto a zona é mais velha (anos) */
  eleitor?: number
  comEscolaridade: EfeitoIdade
  semEscolaridade?: EfeitoIdade | null
}) {
  const topo = Math.max(eleitor, Math.abs(comEscolaridade.b), Math.abs(semEscolaridade?.b ?? 0))
  const frac = (v: number) => (100 * Math.abs(v)) / topo
  const w = (v: number) => `${Math.max(1.5, frac(v))}%`
  const linhas = [
    { chave: 'z', rotulo: 'Zona com eleitores mais velhos', valor: `+${eleitor} anos`, largura: w(eleitor), curta: frac(eleitor) < 24, cor: 'var(--azul)', texto: '#fff' },
    {
      chave: 'c', rotulo: 'Idade dos deputados votados, entre lugares de mesma escolaridade', valor: `${comSinal(comEscolaridade.b)} ${Math.abs(comEscolaridade.b) >= 2 ? 'anos' : 'ano'}`,
      largura: w(comEscolaridade.b), curta: frac(comEscolaridade.b) < 24, cor: comEscolaridade.b < 0 ? 'var(--vermelho)' : 'var(--amarelo)', texto: comEscolaridade.b < 0 ? '#fff' : '#121417',
      nota: `intervalo de 95%: ${comSinal(comEscolaridade.lo)} a ${comSinal(comEscolaridade.hi)}`,
    },
    ...(semEscolaridade
      ? [{ chave: 's', rotulo: 'Sem comparar a escolaridade', valor: `${comSinal(semEscolaridade.b)} ${Math.abs(semEscolaridade.b) >= 2 ? 'anos' : 'ano'}`, largura: w(semEscolaridade.b), curta: frac(semEscolaridade.b) < 24, cor: SEPIA[3], texto: '#121417' }]
      : []),
  ]
  const marcas = Array.from({ length: Math.floor(topo) + 1 }, (_, i) => i)
  return (
    <figure className="peca p-4 sm:p-5" aria-label={`Régua de idade: ${linhas.map((l) => `${l.rotulo}, ${l.valor}`).join('; ')}`}>
      <figcaption className="font-[family-name:var(--font-display)] text-[1.15rem] font-extrabold leading-tight text-tinta">
        Se os eleitores de uma zona são 5 anos mais velhos...
      </figcaption>
      <ul className="mt-4 grid gap-4">
        {linhas.map((l, i) => (
          <li key={l.chave}>
            <p className="text-[0.88rem] leading-snug text-tinta-2">{l.rotulo}</p>
            <div className="mt-1 flex h-9 items-center gap-2 rounded-[6px] bg-papel-2">
              <div
                className="barra-cresce flex h-full items-center justify-end rounded-[6px] border-[3px] border-tinta px-2"
                style={{ width: l.largura, minWidth: l.curta ? '0.9rem' : '3.4rem', background: l.cor, color: l.texto, animationDelay: `${i * 120}ms` }}
              >
                {!l.curta && <span className="tabular whitespace-nowrap font-[family-name:var(--font-display)] text-[1.02rem] font-extrabold">{l.valor}</span>}
              </div>
              {l.curta && <span className="tabular whitespace-nowrap font-[family-name:var(--font-display)] text-[1.02rem] font-extrabold text-tinta">{l.valor}</span>}
            </div>
            {l.nota && <p className="tabular mt-0.5 text-[0.76rem] text-tinta-3">{l.nota}</p>}
          </li>
        ))}
      </ul>
      {/* a régua: uma marca por ano, na escala das barras */}
      <div className="relative mt-3 h-6 border-t-[3px] border-tinta" aria-hidden>
        {marcas.map((m) => (
          <span key={m} className="tabular absolute top-0 -translate-x-1/2 text-center text-[0.72rem] leading-none text-tinta-2" style={{ left: `${(100 * m) / topo}%` }}>
            <span className="mx-auto block h-2 w-[2px] bg-tinta" />
            {anos(m, 0)}
          </span>
        ))}
      </div>
      <p className="text-[0.76rem] text-tinta-3">anos a mais</p>
    </figure>
  )
}
