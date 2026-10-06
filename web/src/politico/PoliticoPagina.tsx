import { ArrowLeft } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { consultas, type Candidatura, type Politico } from '../api'
import { CirandaTela } from '../componentes/Ciranda'
import { ErroCarga } from '../componentes/ErroCarga'
import { Retrato } from '../componentes/Retrato'
import { Trajetoria } from '../graficos/Trajetoria'
import { duracaoMandato } from '../lib/carreira'
import { cargo as fmtCargo, nomeProprio } from '../lib/formato'
import { Santinho } from './Santinho'

const ANO_ATUAL = 2026

/** Uma frase sobre a sobrevivência da carreira, tirada dos próprios dados. */
function resumoCarreira(p: Politico): string {
  const ordem = [...p.candidaturas].sort((a, b) => a.ano - b.ano)
  let maior = 0, atual = 0
  for (const c of ordem) {
    atual = c.eleito ? atual + 1 : 0
    maior = Math.max(maior, atual)
  }
  const emMandato = ordem.filter((c) => c.eleito && c.ano + 1 + duracaoMandato(c.cod_cargo) > ANO_ATUAL)
  const ultimo = emMandato[emMandato.length - 1]
  const partes = [
    `${p.resumo.candidaturas} ${p.resumo.candidaturas === 1 ? 'candidatura' : 'candidaturas'} em ${(p.resumo.ultimo_ano ?? 0) - (p.resumo.primeiro_ano ?? 0) + 2} anos`,
    maior > 1 ? `${maior} vitórias seguidas no melhor momento` : null,
    ultimo ? `em mandato de ${fmtCargo(ultimo.cargo).toLowerCase()} até ${ultimo.ano + duracaoMandato(ultimo.cod_cargo)}` : 'sem mandato em curso',
  ]
  return partes.filter(Boolean).join(', ') + '.'
}

function Numero({ valor, rotulo }: { valor: string | number; rotulo: string }) {
  return (
    <div>
      <p className="text-[2.2rem] font-bold leading-none tabular" style={{ fontStretch: '108%' }}>{valor}</p>
      <p className="mt-1.5 text-[0.85rem] font-semibold text-tinta-2">{rotulo}</p>
    </div>
  )
}

export function PoliticoPagina() {
  const { id } = useParams({ from: '/politico/$id' })
  const { data: p, error, isLoading } = useQuery(consultas.politico(Number(id)))

  useEffect(() => {
    if (p) document.title = `${nomeProprio(p.nome)} · Voto Aberto`
  }, [p])

  if (error) return <ErroCarga erro={error} />
  if (isLoading || !p) return <CirandaTela rotulo="Abrindo a carreira..." />

  const nome = nomeProprio(p.nome)
  const recentes: Candidatura[] = [...p.candidaturas].sort((a, b) => b.ano - a.ano || a.cod_cargo - b.cod_cargo)

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-6 md:px-[72px]">
      <Link to="/urna" className="inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-acao hover:underline">
        <ArrowLeft size={14} weight="bold" aria-hidden /> Nova consulta na urna
      </Link>

      <header className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end">
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
          <Retrato foto={p.foto} nome={p.nome} tamanho={128} className="rounded-2xl shadow-[var(--shadow-cartao)]" />
        </motion.div>
        <div className="min-w-0">
          <p className="t-rotulo text-tinta-3">Carreira política</p>
          <h1 className="t-h1 mt-1">{nome}</h1>
          <p className="mt-2 text-tinta-2">
            {p.nascimento_ano ? `Nascido em ${p.nascimento_ano}` : 'Ano de nascimento não informado'}
            {p.ufs.length ? ` · candidaturas em ${p.ufs.join(', ')}` : ' · candidaturas nacionais'}
            {' · nome civil registrado no TSE'}
          </p>
        </div>
      </header>

      <div className="mt-10 grid grid-cols-2 gap-6 border-y border-linha py-7 sm:grid-cols-5">
        <Numero valor={p.resumo.candidaturas} rotulo="candidaturas" />
        <Numero valor={p.resumo.vitorias} rotulo={p.resumo.vitorias === 1 ? 'vez eleito' : 'vezes eleito'} />
        <Numero valor={p.resumo.derrotas} rotulo={p.resumo.derrotas === 1 ? 'derrota' : 'derrotas'} />
        <Numero valor={p.resumo.reeleicoes} rotulo={p.resumo.reeleicoes === 1 ? 'reeleição' : 'reeleições'} />
        <Numero valor={`${p.resumo.primeiro_ano}-${p.resumo.ultimo_ano}`} rotulo="anos de carreira" />
      </div>

      <section aria-labelledby="trajetoria" className="mt-12">
        <h2 id="trajetoria" className="t-h2">Trajetória por cargo</h2>
        <p className="mb-5 mt-2 max-w-[70ch] text-tinta-2">{resumoCarreira(p)}</p>
        <Trajetoria candidaturas={p.candidaturas} />
      </section>

      <section aria-labelledby="santinhos" className="mt-14">
        <h2 id="santinhos" className="t-h2">Santinhos de cada eleição</h2>
        <p className="mt-2 text-tinta-2">Do mais recente ao mais antigo. Os municipais abrem o boletim do município.</p>
        <motion.ol
          className="-mx-4 mt-6 flex snap-x snap-mandatory scroll-pl-4 gap-5 overflow-x-auto px-4 pb-8 pt-3 md:-mx-[72px] md:scroll-pl-[72px] md:px-[72px]"
          initial="fora"
          animate="dentro"
          variants={{ dentro: { transition: { staggerChildren: 0.06 } } }}
        >
          {recentes.map((c, i) => (
            <motion.li
              key={`${c.ano}-${c.cod_cargo}-${i}`}
              className="list-none"
              variants={{ fora: { opacity: 0, x: -24, rotate: -4 }, dentro: { opacity: 1, x: 0, rotate: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } } }}
            >
              <Santinho c={c} nome={p.nome} inclinacao={i % 2 ? -1.2 : 0.9} />
            </motion.li>
          ))}
        </motion.ol>
      </section>
    </div>
  )
}
