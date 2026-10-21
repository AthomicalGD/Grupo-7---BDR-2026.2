// P9: onde a campanha investiu em propaganda? Uma seção da ficha do político: a lista das campanhas com
// prestação de contas (2018 em diante) escolhe qual delas cai em santinhos (Nuvem3D). O 3D só é baixado e
// montado quando a seção chega perto da tela: a ficha abre leve.
import { ArrowRight } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Candidatura } from '../api'
import { EsqueletoPalco } from '../componentes/Esqueleto'
import { situacao } from '../lib/carreira'
import { cargo as fmtCargo, reaisCurto } from '../lib/formato'

const Nuvem3D = lazy(() => import('./Nuvem3D'))
/** As campanhas que têm nuvem: eleições ordinárias de 2018 a 2024 com despesa declarada. */
const comNuvem = (c: Candidatura) => c.ano >= 2018 && !c.suplementar && !!c.gasto

/**
 * Quanto custaram as campanhas e para onde foi o dinheiro: cada campanha da lista abre a sua nuvem.
 * `inicial`: a campanha pedida no endereço (?gasto=id), senão a mais recente.
 */
export function GastosCampanha({ campanhas, inicial }: { campanhas: Candidatura[]; inicial?: number }) {
  const secao = useRef<HTMLElement>(null)
  const comConta = campanhas.filter(comNuvem)
  const [escolhida, setEscolhida] = useState(() => (comConta.some((c) => c.id_candidatura === inicial) ? inicial! : comConta[0]?.id_candidatura))
  // o 3D só nasce quando a seção chega perto da tela (ou já, se veio pelo endereço)
  const [perto, setPerto] = useState(inicial != null)
  useEffect(() => {
    const el = secao.current
    if (!el || perto) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setPerto(true); io.disconnect() } }, { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [perto])
  useEffect(() => {
    if (inicial != null) secao.current?.scrollIntoView({ block: 'start' })
  }, [inicial])

  if (!comConta.length) return null
  const atual = comConta.find((c) => c.id_candidatura === escolhida) ?? comConta[0]
  return (
    <section ref={secao} id="gastos" aria-labelledby="titulo-gastos" className="mt-12 scroll-mt-20">
      <h2 id="titulo-gastos" className="t-h2">Para onde foi o dinheiro das campanhas</h2>
      <p className="mt-2 max-w-[66ch] text-tinta-2">
        Despesa contratada declarada ao TSE, em valores da época (o TSE publica as contas por candidato desde 2018). Escolha a campanha: cada tipo de gasto vira um santinho, do tamanho do valor, e os de propaganda levam o carimbo.
      </p>
      <ul className="mt-5 grid max-w-[880px] grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2" aria-label="Campanhas">
        {comConta.map((c) => {
          const ativa = c.id_candidatura === atual.id_candidatura
          return (
            <li key={c.id_candidatura}>
              <button
                type="button" aria-pressed={ativa} onClick={() => setEscolhida(c.id_candidatura)}
                className={`gastos-campanha flex w-full items-baseline gap-4 rounded-xl px-3 py-2.5 text-left ${ativa ? 'bg-selecao-claro' : 'hover:bg-papel-2'}`}
              >
                <span className="tabular w-11 shrink-0 font-bold">{c.ano}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold" style={ativa ? { color: 'var(--color-selecao-tinta)' } : undefined}>{fmtCargo(c.cargo)}</span>
                  <span className="block text-[0.82rem] text-tinta-3">
                    {situacao(c)}{c.votos ? ` · ${reaisCurto(c.gasto! / c.votos)} por voto` : ''}
                  </span>
                </span>
                <span className="t-numero text-[1.35rem]">{reaisCurto(c.gasto!)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <Link to="/cadeira" className="mt-3 inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-acao hover:underline">
        Quanto custa uma cadeira <ArrowRight size={14} weight="bold" aria-hidden />
      </Link>
      {perto ? (
        <Suspense fallback={<div className="mt-8 h-[min(780px,calc(100dvh-250px))]"><EsqueletoPalco className="rounded-[20px]" /></div>}>
          <Nuvem3D c={atual} />
        </Suspense>
      ) : (
        <div className="mt-8 h-[min(780px,calc(100dvh-250px))]" aria-hidden />
      )}
    </section>
  )
}
