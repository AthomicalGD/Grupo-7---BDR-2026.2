import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect } from 'react'
import { consultas, type Ano, type MunicipioBusca } from '../api'
import { Ciranda, CirandaTela } from '../componentes/Ciranda'
import { ErroCarga } from '../componentes/ErroCarga'
import type { BuscaAtlas } from '../router'
import { Boletim } from './Boletim'
import { CedulaAnos } from './CedulaAnos'
import { Legenda } from './Legenda'
import { Mapa } from './Mapa'
import { PainelBrasil } from './PainelBrasil'
import { PainelEstado } from './PainelEstado'

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
  const ano: Ano = busca.ano ?? 2022
  const relativo = !!busca.relativo
  const sigla = params.sigla?.toUpperCase()
  const ibge = params.ibge ? Number(params.ibge) : undefined
  const relevo = !!busca.relevo && !!sigla

  const malhaBrasil = useQuery(consultas.malhaBrasil())
  const ufs = useQuery(consultas.ufs())
  const malhaUF = useQuery({ ...consultas.malhaUF(sigla ?? ''), enabled: !!sigla })
  const detalheUF = useQuery({ ...consultas.uf(sigla ?? ''), enabled: !!sigla })
  const municipio = useQuery({ ...consultas.municipio(ibge ?? 0), enabled: !!ibge })

  const mudarBusca = useCallback(
    (parcial: Partial<BuscaAtlas>) => navegar({ to: '.', search: (s: BuscaAtlas) => ({ ...s, ...parcial }), replace: true }),
    [navegar],
  )
  const mudarAno = useCallback((a: Ano) => mudarBusca({ ano: a }), [mudarBusca])
  const irUF = useCallback(
    (s: string) => navegar({ to: '/uf/$sigla', params: { sigla: s }, search: (b: BuscaAtlas) => b }),
    [navegar],
  )
  const irMunicipio = useCallback(
    (cod: number, uf = sigla ?? '') =>
      navegar({ to: '/uf/$sigla/$ibge', params: { sigla: uf, ibge: String(cod) }, search: (b: BuscaAtlas) => b }),
    [navegar, sigla],
  )
  const escolherNaBusca = useCallback((m: MunicipioBusca) => irMunicipio(m.ibge, m.uf), [irMunicipio])

  const nomeUF = ufs.data?.find((u) => u.sigla === sigla)?.nome
  useEffect(() => {
    const partes = [municipio.data?.nome, nomeUF].filter(Boolean)
    document.title = partes.length ? `${partes.join(', ')} · Voto Aberto` : 'Voto Aberto · para onde o voto pendeu'
  }, [municipio.data?.nome, nomeUF])

  if (malhaBrasil.isError || ufs.isError) return <ErroCarga erro={malhaBrasil.error ?? ufs.error} />
  if (!malhaBrasil.data || !ufs.data) return <CirandaTela rotulo="Abrindo o mapa do Brasil..." />

  const carregandoUF = !!sigla && (malhaUF.isLoading || detalheUF.isLoading)
  const chavePainel = ibge ? `m-${ibge}` : sigla ? `e-${sigla}` : 'brasil'

  let painel
  if (ibge) {
    painel = municipio.data ? (
      <Boletim m={municipio.data} ano={ano} aoFechar={() => irUF(sigla!)} />
    ) : municipio.isError ? (
      <ErroCarga erro={municipio.error} compacto />
    ) : (
      <div className="grid min-h-[40dvh] place-items-center"><Ciranda rotulo="Imprimindo o boletim..." /></div>
    )
  } else if (sigla) {
    painel = detalheUF.data ? (
      <PainelEstado
        uf={detalheUF.data}
        ano={ano}
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
      <div className="grid min-h-[40dvh] place-items-center"><Ciranda rotulo={`Apurando ${nomeUF ?? sigla}...`} /></div>
    )
  } else {
    painel = <PainelBrasil ufs={ufs.data} malha={malhaBrasil.data} ano={ano} aoEscolherUF={irUF} aoEscolherMunicipio={escolherNaBusca} />
  }

  return (
    <div className="mx-auto grid max-w-[1440px] gap-8 px-4 pt-6 md:px-[72px] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12 lg:pt-8">
      <section aria-label="Mapa" className="flex flex-col gap-4 lg:sticky lg:top-[100px] lg:h-[calc(100dvh-164px)] lg:self-start">
        <CedulaAnos ano={ano} aoMudar={mudarAno} />
        <div className="relative h-[58dvh] min-h-[340px] lg:h-auto lg:min-h-0 lg:flex-1">
          {relevo && detalheUF.data && malhaUF.data ? (
            <Suspense fallback={<div className="grid h-full place-items-center"><Ciranda rotulo="Levantando o relevo..." /></div>}>
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
              aoEscolherMunicipio={(c) => irMunicipio(c)}
            />
          )}
          <AnimatePresence>
            {carregandoUF && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 grid place-items-center bg-papel/40">
                <Ciranda rotulo={`Carregando os municípios de ${nomeUF ?? sigla}...`} tamanho={96} />
              </motion.div>
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
