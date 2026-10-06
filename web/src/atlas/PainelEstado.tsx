import type { ReactNode } from 'react'
import { Cube, MapTrifold } from '@phosphor-icons/react'
import type { Ano, MunicipioBusca, UFDetalhe } from '../api'
import { BarrasDivergentes } from '../graficos/BarrasDivergentes'
import { ViesTempo } from '../graficos/ViesTempo'
import { inteiro, pct, vies as fmtVies } from '../lib/formato'
import { corVies, ladoVies } from '../lib/vies'
import { BuscaMunicipio } from './BuscaMunicipio'
import { Trilha } from './Trilha'

interface Props {
  uf: UFDetalhe
  ano: Ano
  relativo: boolean
  relevo: boolean
  aoMudarRelativo: (r: boolean) => void
  aoMudarRelevo: (r: boolean) => void
  aoEscolherMunicipio: (m: MunicipioBusca) => void
  aoAbrirMunicipio: (ibge: number) => void
}

export function Alternador<T extends string>({ rotulo, opcoes, valor, aoMudar }: {
  rotulo: string
  opcoes: { valor: T; rotulo: string; icone?: ReactNode }[]
  valor: T
  aoMudar: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex rounded-full border border-linha bg-folha p-1">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => aoMudar(o.valor)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.82rem] font-semibold transition-colors ${valor === o.valor ? 'bg-tinta text-white' : 'text-tinta-2 hover:text-tinta'}`}
        >
          {o.icone}
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

export function PainelEstado({ uf, ano, relativo, relevo, aoMudarRelativo, aoMudarRelevo, aoEscolherMunicipio, aoAbrirMunicipio }: Props) {
  const v = uf.vies[ano]
  const doAno = uf.municipios.filter((m) => m.vies[ano] != null).sort((a, b) => a.vies[ano]! - b.vies[ano]!)
  const esquerda = doAno.slice(0, 3)
  const direita = doAno.slice(-3).reverse()
  const semVies = uf.sem_vies_pct[ano]

  if (!uf.carregada) {
    return (
      <div className="space-y-5">
        <Trilha uf={uf.nome} />
        <h1 className="t-h1">{uf.nome}</h1>
        <p className="max-w-[52ch] text-tinta-2">
          Este estado ainda não foi carregado no banco, então não há viés para mostrar. O mapa e a busca de municípios
          continuam funcionando.
        </p>
        <p className="rounded-2xl border border-linha bg-folha p-4 text-[0.9rem]">
          Para carregar: <code className="t-mono">python -m loader {uf.sigla}</code> e reinicie a API.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-9">
      <header className="space-y-3">
        <Trilha uf={uf.nome} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="t-h1">{uf.nome}</h1>
            <p className="mt-1 text-tinta-2">
              {uf.municipios.length} municípios · região {uf.regiao}
            </p>
          </div>
          <div className="text-right">
            <p className="t-numero text-[2.6rem]" style={{ color: v != null && Math.abs(v) > 30 ? corVies(v) : undefined }}>
              {fmtVies(v)}
            </p>
            <p className="text-[0.82rem] text-tinta-2">{ladoVies(v)} em {ano}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Alternador
            rotulo="Escala de cor"
            valor={relativo ? 'relativa' : 'absoluta'}
            aoMudar={(x) => aoMudarRelativo(x === 'relativa')}
            opcoes={[{ valor: 'absoluta', rotulo: 'Escala absoluta' }, { valor: 'relativa', rotulo: 'Relativa ao estado' }]}
          />
          <Alternador
            rotulo="Visão do mapa"
            valor={relevo ? 'relevo' : 'mapa'}
            aoMudar={(x) => aoMudarRelevo(x === 'relevo')}
            opcoes={[
              { valor: 'mapa', rotulo: 'Mapa', icone: <MapTrifold size={15} aria-hidden /> },
              { valor: 'relevo', rotulo: 'Relevo 3D', icone: <Cube size={15} aria-hidden /> },
            ]}
          />
        </div>
      </header>

      <BuscaMunicipio uf={uf.sigla} aoEscolher={aoEscolherMunicipio} rotulo={`Digite um município do ${uf.sigla}`} />

      <section aria-labelledby="estado-tempo" className="space-y-3">
        <h2 id="estado-tempo" className="t-h3">O estado na linha do tempo</h2>
        <ViesTempo principal={{ nome: uf.nome, valores: uf.vies }} anoAtivo={ano} />
        <p className="text-[0.82rem] leading-relaxed text-tinta-3">
          2018 e 2022 somam presidente, governador, senado e deputados; 2020 e 2024, prefeito e vereador. Compare anos do
          mesmo tipo.
        </p>
      </section>

      <section aria-labelledby="estado-extremos" className="space-y-3">
        <h2 id="estado-extremos" className="t-h3">Extremos em {ano}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { titulo: 'Mais à esquerda', lista: esquerda },
            { titulo: 'Mais à direita', lista: direita },
          ].map((g) => (
            <div key={g.titulo} className="rounded-2xl border border-linha bg-folha p-3">
              <p className="t-rotulo mb-1.5 px-1 text-tinta-3">{g.titulo}</p>
              <ul>
                {g.lista.map((m) => (
                  <li key={m.ibge}>
                    <button type="button" onClick={() => aoAbrirMunicipio(m.ibge)} className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-papel">
                      <span className="size-3 shrink-0 rounded-full" style={{ background: corVies(m.vies[ano]) }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-semibold">{m.nome}</span>
                      <span className="tabular text-tinta-2">{fmtVies(m.vies[ano])}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="estado-regioes" className="space-y-3">
        <h2 id="estado-regioes" className="t-h3">Regiões intermediárias em {ano}</h2>
        <BarrasDivergentes titulo={`Viés das regiões intermediárias do ${uf.sigla} em ${ano}`} itens={uf.regioes.map((r) => ({ nome: r.nome, valor: r.vies[ano] }))} />
      </section>

      <p className="border-t border-linha pt-4 text-[0.82rem] leading-relaxed text-tinta-3">
        {pct(semVies)} dos votos válidos de {ano} foram para partidos sem viés informado, que contam como 0 e puxam a média
        para o centro. Eleitores aptos no estado em {ano}:{' '}
        {inteiro(uf.municipios.reduce((s, m) => s + (m.aptos[ano] ?? 0), 0))}.
      </p>
    </div>
  )
}
