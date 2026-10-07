// Santinho: o cartão de cada eleição da carreira, com o carimbo do resultado.
import { Link } from '@tanstack/react-router'
import type { Candidatura } from '../api'
import { Retrato } from '../componentes/Retrato'
import { situacao } from '../lib/carreira'
import { cargo as fmtCargo, inteiro, reaisCurto } from '../lib/formato'

const FITAS = ['#5E881B', '#A2BD31', '#5D6B94', '#468BAF', '#76ACD0', '#F19929', '#FBC700']

const CARIMBO: Record<string, string> = {
  Eleito: 'var(--color-eleito)',
  'Eleito no 2º turno': 'var(--color-eleito)',
  Reeleito: 'var(--color-reeleito)',
  'Não eleito': 'var(--color-tinta-3)',
}

export function Santinho({ c, nome, inclinacao }: { c: Candidatura; nome: string; inclinacao: number }) {
  const resultado = situacao(c)
  const municipal = c.municipio_ibge != null && c.uf
  const corpo = (
    <>
      <div className="flex h-2.5" aria-hidden>
        {FITAS.map((f) => <span key={f} className="flex-1" style={{ background: f }} />)}
      </div>
      <div className="flex gap-3 p-4 pb-3">
        <Retrato foto={c.foto} nome={nome} tamanho={58} />
        <div className="min-w-0">
          <p className="text-[2.35rem] leading-[0.9] font-black tabular" style={{ fontStretch: '80%' }}>{c.ano}</p>
          <p className="mt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.08em]">{fmtCargo(c.cargo)}</p>
          <p className="truncate text-[0.8rem] text-tinta-2">{c.local}</p>
        </div>
      </div>
      <div className="flex items-end justify-between gap-2 px-4 pb-4">
        <div className="text-[0.76rem] leading-snug text-tinta-3">
          <p>{c.partido ? `Partido ${c.partido}` : 'Partido não registrado'}</p>
          {c.votos != null && <p className="font-semibold text-tinta tabular">{inteiro(c.votos)} votos</p>}
          {/* P1: o que a campanha gastou (valor da época); o TSE só publica as contas desde 2018 aqui */}
          {c.gasto != null && (
            <>
              <p className="tabular whitespace-nowrap">Campanha de {reaisCurto(c.gasto)}</p>
              {c.votos ? <p className="tabular whitespace-nowrap">{reaisCurto(c.gasto / c.votos)} por voto</p> : null}
            </>
          )}
          {c.suplementar && <p>Eleição suplementar</p>}
        </div>
        <span
          className="shrink-0 -rotate-6 rounded-[5px] border-2 px-2 py-0.5 text-[0.7rem] font-black uppercase tracking-[0.08em]"
          style={{ color: CARIMBO[resultado], borderColor: CARIMBO[resultado] }}
        >
          {resultado}
        </span>
      </div>
    </>
  )
  const classe = 'block w-[236px] shrink-0 snap-start overflow-hidden rounded-2xl bg-folha shadow-[var(--shadow-cartao)] transition-transform duration-300 hover:-translate-y-1 hover:rotate-0'
  return municipal ? (
    <Link to="/uf/$sigla/$ibge" params={{ sigla: c.uf!, ibge: String(c.municipio_ibge) }} className={classe} style={{ rotate: `${inclinacao}deg` }} aria-label={`${c.ano}, ${fmtCargo(c.cargo)} em ${c.local}: ${resultado}. Abrir o boletim do município`}>
      {corpo}
    </Link>
  ) : (
    <article className={classe} style={{ rotate: `${inclinacao}deg` }} aria-label={`${c.ano}, ${fmtCargo(c.cargo)} em ${c.local}: ${resultado}`}>
      {corpo}
    </article>
  )
}
