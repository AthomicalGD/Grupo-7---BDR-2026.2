// A galeria dos ex-prefeitos (assinatura da P6): a parede de retratos que toda prefeitura tem, de 1996 a 2024.
// Cada moldura é um mandato, com o retrato do TSE (desde 2004; antes, as iniciais), o nome de urna e o partido
// com a bolinha na cor do viés. Quem foi reeleito ocupa uma moldura dupla, como nas galerias de verdade. Entre
// as molduras, a marca da passagem: = mesmo partido, ≠ troca, ~ troca com ressalva (fusão). As molduras
// "penduram" uma vez, da esquerda para a direita, quando a galeria aparece.
import { Link } from '@tanstack/react-router'
import { useInView } from 'motion/react'
import { useRef } from 'react'
import type { IdadeMunicipio, Passagem, PrefeitoGaleria } from '../api'
import { Retrato } from '../componentes/Retrato'
import { nomeProprio } from '../lib/formato'
import { corVies } from '../lib/vies'
import { MARCA } from './sepia'

interface Moldura {
  pessoas: PrefeitoGaleria[]
  /** a passagem que trouxe esta moldura (em relação à anterior) */
  chegada: Passagem | null
}

/** Junta os mandatos seguidos da mesma pessoa numa moldura só (a reeleição). */
function molduras(galeria: PrefeitoGaleria[]): Moldura[] {
  const saida: Moldura[] = []
  for (const g of galeria) {
    const ultima = saida[saida.length - 1]
    if (ultima && g.mesma_pessoa) ultima.pessoas.push(g)
    else saida.push({ pessoas: [g], chegada: g.passagem })
  }
  return saida
}

function Bolinha({ vies }: { vies: number | null }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full border border-tinta/20"
      style={{ background: vies == null ? 'var(--color-neutro)' : corVies(vies) }}
      aria-hidden
    />
  )
}

function Marca({ passagem, compacta }: { passagem: Passagem; compacta?: boolean }) {
  const m = MARCA[passagem]
  return (
    <span className="flex shrink-0 flex-col items-center justify-center gap-1 self-center px-0.5" title={m.nome}>
      <span
        className={`grid place-items-center rounded-full border-[1.5px] border-tinta-2 bg-folha font-bold leading-none text-tinta ${compacta ? 'size-6 text-[0.9rem]' : 'size-8 text-[1.1rem]'}`}
        aria-hidden
      >
        {m.sinal}
      </span>
      {!compacta && <span className="max-w-[4.5rem] text-center text-[0.66rem] leading-tight text-tinta-3">{m.curto}</span>}
      <span className="sr-only">{m.nome}</span>
    </span>
  )
}

export function Galeria({ dados, compacta = false }: { dados: IdadeMunicipio; compacta?: boolean }) {
  const ref = useRef<HTMLOListElement>(null)
  const visto = useInView(ref, { once: true, amount: 0.2 })
  const lista = molduras(dados.galeria)
  if (!lista.length) return <p className="text-[0.86rem] text-tinta-3">Sem prefeitos eleitos registrados.</p>
  const tam = compacta ? 44 : 72
  return (
    <div className={compacta ? '' : '-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0'}>
      <ol
        ref={ref}
        aria-label={`Prefeitos eleitos em ${dados.nome}, de ${dados.galeria[0].ano} a ${dados.galeria[dados.galeria.length - 1].ano}`}
        className={`flex items-stretch ${compacta ? 'flex-wrap gap-x-1 gap-y-3' : 'w-max gap-x-1.5 pt-2'}`}
      >
        {lista.map((mol, i) => {
          const [primeiro] = mol.pessoas
          const ultimo = mol.pessoas[mol.pessoas.length - 1]
          const dupla = mol.pessoas.length > 1
          const partidos = [...new Set(mol.pessoas.map((p) => p.partido))]
          const mandato = `${primeiro.ano + 1} a ${ultimo.ano + 4}`
          return (
            <li key={primeiro.ano} className="flex items-stretch gap-x-1.5">
              {i > 0 && mol.chegada && <Marca passagem={mol.chegada} compacta={compacta} />}
              <Link
                to="/politico/$id"
                params={{ id: String(primeiro.id_politico) }}
                aria-label={`${nomeProprio(ultimo.nome_urna)}, ${partidos.join(' e depois ')}, mandato de ${mandato}${dupla ? ' (reeleito)' : ''}. Abrir a carreira`}
                className={`moldura-galeria group flex flex-col rounded-[6px] border border-linha bg-folha shadow-[var(--shadow-cartao)] transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acao ${compacta ? 'p-1.5' : 'p-2'} ${visto ? 'pendura' : ''}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* o filete azul da moldura e os retratos (dois na reeleição, lado a lado) */}
                <span className="flex gap-1 rounded-[3px] p-[3px] ring-[1.5px] ring-[#153f7a]">
                  {(dupla && !compacta ? [primeiro, ultimo] : [primeiro]).map((p, k) => (
                    <Retrato key={k} foto={p.foto} nome={p.nome_urna} tamanho={tam} className="rounded-[2px]" />
                  ))}
                </span>
                <span className={`mt-1.5 block text-center ${compacta ? 'w-[3.6rem]' : dupla ? 'w-[9.6rem]' : 'w-[5.2rem]'}`}>
                  <span className={`tabular block font-bold text-tinta ${compacta ? 'text-[0.7rem]' : 'text-[0.76rem]'}`}>{mandato}</span>
                  <span className={`line-clamp-2 block leading-tight text-tinta group-hover:underline ${compacta ? 'text-[0.68rem]' : 'text-[0.78rem]'}`}>
                    {nomeProprio(ultimo.nome_urna)}
                  </span>
                  <span className={`mt-0.5 flex flex-wrap items-center justify-center gap-x-1 t-mono text-tinta-2 ${compacta ? 'text-[0.62rem]' : 'text-[0.68rem]'}`}>
                    {mol.pessoas
                      .filter((p, k) => k === 0 || p.partido !== mol.pessoas[k - 1].partido)
                      .map((p, k) => (
                        <span key={p.ano} className="inline-flex items-center gap-1">
                          {k > 0 && <span aria-hidden>→</span>}
                          <Bolinha vies={p.vies} />
                          {p.partido}
                        </span>
                      ))}
                  </span>
                  {dupla && !compacta && <span className="mt-0.5 block text-[0.66rem] text-tinta-3">reeleito</span>}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** A legenda dos sinais da galeria. */
export function LegendaGaleria() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.78rem] text-tinta-2">
      {(Object.keys(MARCA) as Passagem[]).map((p) => (
        <span key={p} className="inline-flex items-center gap-1.5">
          <span className="grid size-5 place-items-center rounded-full border-[1.5px] border-tinta-2 bg-folha text-[0.78rem] font-bold leading-none text-tinta" aria-hidden>
            {MARCA[p].sinal}
          </span>
          {MARCA[p].nome}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-4 w-6 rounded-[2px] border border-linha bg-folha shadow-[var(--shadow-cartao)]" aria-hidden />
        moldura dupla = reeleição
      </span>
    </p>
  )
}
