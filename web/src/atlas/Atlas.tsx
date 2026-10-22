import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect } from 'react'
import { ANOS, consultas, type Ano, type MunicipioBusca } from '../api'
import { Atrasado, EsqueletoBloco, EsqueletoPagina, EsqueletoPalco } from '../componentes/Esqueleto'
import { ErroCarga } from '../componentes/ErroCarga'
import type { BuscaAtlas } from '../router'
import { Boletim } from './Boletim'
import { CedulaAnos } from './CedulaAnos'
import { Legenda } from './Legenda'
import { Mapa } from './Mapa'
import { PainelBrasil } from './PainelBrasil'
import { PainelEstado } from './PainelEstado'
import { PilulaCargo, SeletorCargo } from './SeletorCargo'

const Relevo3D = lazy(() => import('../relevo/Relevo3D'))

const entrada = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } },
}

export function Atlas() {
  const params = useParams({ strict: false }) as { sigla?: string; ibge?: string }
  const busca = useSearch({ strict: false }) as BuscaAtlas
  const navegar = useNavigate()
  const cargo = busca.cargo
  const cargos = useQuery(consultas.cargosVies())
  const doCargo = cargos.data?.find((c) => c.cod === cargo)
  // com um cargo escolhido, só os anos em que ele foi disputado; o ano pedido vai para o válido mais próximo
  const anos: readonly Ano[] = doCargo?.anos.length ? doCargo.anos : ANOS
  const pedido: Ano = busca.ano ?? 2022
  const ano: Ano = anos.includes(pedido) ? pedido : anos.reduce((a, b) => (Math.abs(b - pedido) < Math.abs(a - pedido) ? b : a))
  const relativo = !!busca.relativo
  const sigla = params.sigla?.toUpperCase()
  const ibge = params.ibge ? Number(params.ibge) : undefined
  const relevo = !!busca.relevo && !!sigla

  const malhaBrasil = useQuery(consultas.malhaBrasil())
  // a troca de cargo mantém o mapa anterior até o novo chegar (sem piscar o "carregando")
  const ufs = useQuery({ ...consultas.ufs(cargo), placeholderData: keepPreviousData })
  const malhaUF = useQuery({ ...consultas.malhaUF(sigla ?? ''), enabled: !!sigla })
  const detalheUF = useQuery({ ...consultas.uf(sigla ?? '', cargo), enabled: !!sigla, placeholderData: (anterior) => (anterior?.sigla === sigla ? anterior : undefined) })
  const municipio = useQuery({ ...consultas.municipio(ibge ?? 0, cargo), enabled: !!ibge, placeholderData: (anterior) => (anterior?.ibge === ibge ? anterior : undefined) })

  const mudarBusca = useCallback(
    (parcial: Partial<BuscaAtlas>) => navegar({ to: '.', search: (s: BuscaAtlas) => ({ ...s, ...parcial }), replace: true }),
    [navegar],
  )
  const mudarAno = useCallback((a: Ano) => mudarBusca({ ano: a }), [mudarBusca])
  const mudarCargo = useCallback((c: number | undefined) => mudarBusca({ cargo: c }), [mudarBusca])
  const irUF = useCallback(
    (s: string) => navegar({ to: '/uf/$sigla', params: { sigla: s }, search: (b: BuscaAtlas) => b }),
    [navegar],
  )
  const irMunicipio = useCallback(
    (cod: number, uf = sigla ?? '') =>
      navegar({ to: '/uf/$sigla/$ibge', params: { sigla: uf, ibge: String(cod) }, search: (b: BuscaAtlas) => b }),
    [navegar, sigla],
  )
  // apontar um estado (mouse ou foco) já pede a malha e o detalhe dele: o clique encontra tudo pronto
  const cliente = useQueryClient()
  const preverUF = useCallback(
    (s: string) => {
      void cliente.prefetchQuery(consultas.malhaUF(s))
      void cliente.prefetchQuery(consultas.uf(s, cargo))
    },
    [cliente, cargo],
  )
  const escolherNaBusca = useCallback((m: MunicipioBusca) => irMunicipio(m.ibge, m.uf), [irMunicipio])

  const nomeUF = ufs.data?.find((u) => u.sigla === sigla)?.nome
  useEffect(() => {
    const partes = [municipio.data?.nome, nomeUF].filter(Boolean)
    document.title = partes.length ? `${partes.join(', ')} · Voto Aberto` : 'Voto Aberto · para onde o voto pendeu'
  }, [municipio.data?.nome, nomeUF])

  if (malhaBrasil.isError || ufs.isError) return <ErroCarga erro={malhaBrasil.error ?? ufs.error} />
  if (!malhaBrasil.data || !ufs.data) return <Atrasado><EsqueletoPagina variante="mapa" rotulo="Abrindo o mapa do Brasil..." /></Atrasado>

  const carregandoUF = !!sigla && (malhaUF.isLoading || detalheUF.isLoading)
  const chavePainel = ibge ? `m-${ibge}` : sigla ? `e-${sigla}` : 'brasil'

  let painel
  if (ibge) {
    painel = municipio.data ? (
      <Boletim m={municipio.data} ano={ano} cargo={doCargo?.nome} aoFechar={() => irUF(sigla!)} />
    ) : municipio.isError ? (
      <ErroCarga erro={municipio.error} compacto />
    ) : (
      <Atrasado><EsqueletoBloco altura="34dvh" linhas={3} rotulo="Imprimindo o boletim..." /></Atrasado>
    )
  } else if (sigla) {
    painel = detalheUF.data ? (
      <PainelEstado
        uf={detalheUF.data}
        ano={ano}
        cargo={doCargo}
        relativo={relativo}
        relevo={relevo}
        aoMudarRelativo={(r) => mudarBusca({ relativo: r || undefined })}
        aoMudarRelevo={(r) => mudarBusca({ relevo: r || undefined })}
        aoEscolherMunicipio={escolherNaBusca}
        aoAbrirMunicipio={(c) => irMunicipio(c)}
      />
    ) : detalheUF.isError ? (
      <ErroCarga erro={detalheUF.error} compacto />
    ) : (
      <Atrasado><EsqueletoBloco altura="34dvh" linhas={3} rotulo={`Apurando ${nomeUF ?? sigla}...`} /></Atrasado>
    )
  } else {
    painel = <PainelBrasil ufs={ufs.data} malha={malhaBrasil.data} ano={ano} cargo={doCargo?.nome} aoEscolherUF={irUF} aoApontarUF={preverUF} aoEscolherMunicipio={escolherNaBusca} />
  }

  return (
    <div className="mx-auto grid max-w-[var(--casca-max)] gap-8 px-4 pt-5 md:px-[var(--casca-margem)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12 lg:pt-6">
      <section aria-label="Mapa" className="flex flex-col gap-4 lg:sticky lg:top-[81px] lg:h-[calc(100dvh-133px)] lg:self-start">
        <CedulaAnos
          ano={ano}
          anos={anos}
          aoMudar={mudarAno}
          extra={cargos.data && <SeletorCargo cargos={cargos.data} cargo={cargo} aoMudar={mudarCargo} />}
        />
        <div className="relative h-[58dvh] min-h-[340px] lg:h-auto lg:min-h-0 lg:flex-1">
          {relevo && detalheUF.data && malhaUF.data ? (
            <Suspense fallback={<EsqueletoPalco />}>
              <Relevo3D malha={malhaUF.data} uf={detalheUF.data} ano={ano} relativo={relativo} ibge={ibge} aoEscolher={(c) => irMunicipio(c)} />
            </Suspense>
          ) : (
            <Mapa
              malhaBrasil={malhaBrasil.data}
              ufs={ufs.data}
              ano={ano}
              sigla={sigla}
              ibge={ibge}
              malhaUF={malhaUF.data}
              detalheUF={detalheUF.data}
              relativo={relativo}
              aoEscolherUF={irUF}
              aoApontarUF={preverUF}
              aoEscolherMunicipio={(c) => irMunicipio(c)}
            />
          )}
          {doCargo && (
            <div className="absolute left-3 top-3 z-10">
              <PilulaCargo nome={doCargo.nome} aoTirar={() => mudarCargo(undefined)} />
            </div>
          )}
          <AnimatePresence>
            {carregandoUF && (
              // sem aviso por cima do mapa: o estado já está desenhado e os municípios entram em anéis quando chegam
              <motion.span initial={false} exit={{ opacity: 0 }} className="sr-only" role="status">
                Carregando os municípios de {nomeUF ?? sigla}...
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <Legenda relativo={relativo && !!sigla} />
      </section>

      <section aria-live="polite" className="min-w-0 pb-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={chavePainel} {...entrada}>
            {painel}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  )
}
