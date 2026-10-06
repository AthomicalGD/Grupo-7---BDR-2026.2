import { useMemo } from 'react'
import type { Ano, Malha, MunicipioBusca, UF } from '../api'
import { vies as fmtVies } from '../lib/formato'
import { corVies } from '../lib/vies'
import { BuscaMunicipio } from './BuscaMunicipio'
import { silhueta } from './geo'

interface Props {
  ufs: UF[]
  malha: Malha
  ano: Ano
  aoEscolherUF: (sigla: string) => void
  aoEscolherMunicipio: (m: MunicipioBusca) => void
}

const ORDEM_REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']

export function PainelBrasil({ ufs, malha, ano, aoEscolherUF, aoEscolherMunicipio }: Props) {
  const silhuetas = useMemo(() => new Map(ufs.map((u) => [u.sigla, silhueta(malha, u.cd_ibge, 40)])), [ufs, malha])
  const carregadas = ufs.filter((u) => u.carregada).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const faltam = ufs.filter((u) => !u.carregada)
  const comValor = carregadas.filter((u) => u.vies[ano] != null)
  const maisEsq = comValor.length ? comValor.reduce((a, b) => (a.vies[ano]! <= b.vies[ano]! ? a : b)) : undefined
  const maisDir = comValor.length ? comValor.reduce((a, b) => (a.vies[ano]! >= b.vies[ano]! ? a : b)) : undefined

  return (
    <div className="space-y-9">
      <header className="space-y-4">
        <h1 className="t-display">Para onde o voto pendeu</h1>
        <p className="max-w-[54ch] text-[1.05rem] leading-relaxed text-tinta-2">
          Viés partidário de cada estado e município de 2018 a 2024, de −100 (esquerda) a +100 (direita), calculado
          com os votos válidos de todos os cargos.
        </p>
      </header>

      <BuscaMunicipio aoEscolher={aoEscolherMunicipio} />

      <section aria-labelledby="estados-com-dados" className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="estados-com-dados" className="t-h3">Estados com dados</h2>
          <span className="text-[0.82rem] text-tinta-3 tabular">viés em {ano}</span>
        </div>
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {carregadas.map((u) => {
            const v = u.vies[ano]
            return (
              <li key={u.sigla}>
                <button
                  type="button"
                  onClick={() => aoEscolherUF(u.sigla)}
                  className="group flex w-full items-center gap-3.5 rounded-2xl border border-linha bg-folha px-3.5 py-3 text-left transition-[border-color,transform,box-shadow] hover:border-tinta hover:shadow-[var(--shadow-cartao)] active:scale-[0.99]"
                >
                  <svg viewBox="0 0 40 40" className="size-10 shrink-0 overflow-visible" aria-hidden>
                    <path d={silhuetas.get(u.sigla)} fill={corVies(v)} stroke="var(--color-tinta)" strokeWidth={0.9} strokeLinejoin="round" className="mapa-forma" />
                  </svg>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{u.nome}</span>
                    <span className="t-mono block text-[0.75rem] text-tinta-3">{u.sigla}</span>
                  </span>
                  <span className="t-numero text-[1.45rem] tabular">{fmtVies(v)}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {maisEsq && maisDir && maisEsq !== maisDir && (
          <p className="text-[0.9rem] text-tinta-2">
            Em {ano}, entre os estados carregados, <b className="text-tinta">{maisEsq.nome}</b> foi o mais à esquerda (
            <span className="tabular">{fmtVies(maisEsq.vies[ano])}</span>) e <b className="text-tinta">{maisDir.nome}</b> o mais à
            direita (<span className="tabular">{fmtVies(maisDir.vies[ano])}</span>).
          </p>
        )}
      </section>

      <section aria-labelledby="sem-dados" className="space-y-3 border-t border-linha pt-6">
        <h2 id="sem-dados" className="t-rotulo text-tinta-2">
          {faltam.length} estados sem dados carregados
        </h2>
        <ul className="flex flex-wrap gap-1.5">
          {[...faltam]
            .sort((a, b) => ORDEM_REGIOES.indexOf(a.regiao) - ORDEM_REGIOES.indexOf(b.regiao) || a.nome.localeCompare(b.nome))
            .map((u) => (
              <li key={u.sigla} title={u.nome} className="flex items-center gap-1 rounded-lg bg-papel-2/70 py-1 pl-1 pr-2">
                <svg viewBox="0 0 40 40" className="size-6" aria-hidden>
                  <path d={silhuetas.get(u.sigla)} fill="#eceef0" stroke="var(--color-linha-2)" strokeWidth={1.2} />
                </svg>
                <span className="t-mono text-[0.72rem] text-tinta-3">{u.sigla}</span>
              </li>
            ))}
        </ul>
        <p className="text-[0.82rem] text-tinta-3">
          Para carregar: <code className="t-mono rounded bg-papel-2 px-1.5 py-0.5 text-tinta-2">python -m loader SP MG</code>
        </p>
      </section>
    </div>
  )
}
