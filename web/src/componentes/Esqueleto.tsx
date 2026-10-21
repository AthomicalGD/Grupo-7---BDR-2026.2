// Esqueletos: enquanto os dados chegam, aparece o formato do que vem (título, texto, palco, painel), no lugar de um
// loading que gira. Três regras, das boas práticas de carregamento: nada aparece nos primeiros 300 ms (um aviso que
// pisca e some parece defeito); o esqueleto tem o desenho da página que vai entrar, então a troca não pula; e cada
// parte é trocada pelo conteúdo assim que chega (as páginas mostram o que já têm e esqueletam só o resto).
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

/** Um bloco cinza do esqueleto (o pulso suave é só CSS e para com o movimento reduzido). */
function Osso({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={`osso block ${className}`} style={style} />
}

// quando o esqueleto da troca de página (o do roteador) acabou de sair, o da página entra na hora: esperar 300 ms de
// novo faria esqueleto, tela vazia e esqueleto
let ultimoEsqueleto = 0

/** Só mostra os filhos depois de `ms`: carregamentos rápidos ficam invisíveis. */
export function Atrasado({ ms = 300, children }: { ms?: number; children: ReactNode }) {
  const [ja, setJa] = useState(() => ms <= 0 || Date.now() - ultimoEsqueleto < 800)
  useEffect(() => {
    if (ja) return
    const t = setTimeout(() => setJa(true), ms)
    return () => clearTimeout(t)
  }, [ms, ja])
  return ja ? <>{children}</> : null
}

/** O aviso para leitores de tela (o esqueleto em si é decorativo). */
const Aviso = ({ rotulo }: { rotulo: string }) => <span className="sr-only" role="status">{rotulo}</span>

/** Linhas de texto: a última mais curta, como um parágrafo. */
function Linhas({ n = 3, className = '' }: { n?: number; className?: string }) {
  return (
    <span className={`grid gap-2 ${className}`}>
      {Array.from({ length: n }, (_, i) => <Osso key={i} className="h-3.5 rounded-full" style={{ width: i === n - 1 ? '62%' : `${92 - i * 4}%` }} />)}
    </span>
  )
}

/** O palco dos 3D vazio: o mesmo céu claro, onde a cena vai aparecer. */
export function EsqueletoPalco({ className = '' }: { className?: string }) {
  return (
    <div className={`esqueleto-palco h-full w-full ${className}`}>
      <Aviso rotulo="Montando a cena..." />
    </div>
  )
}

/** Um bloco de seção: título curto, texto e uma área do tamanho do gráfico que vem. */
export function EsqueletoBloco({ altura = 240, linhas = 2, className = '', rotulo = 'Carregando...' }: { altura?: number | string; linhas?: number; className?: string; rotulo?: string }) {
  return (
    <div className={`grid gap-4 ${className}`}>
      <Aviso rotulo={rotulo} />
      {linhas > 0 && <Linhas n={linhas} className="max-w-[46ch]" />}
      <Osso className="rounded-2xl" style={{ height: altura }} />
    </div>
  )
}

/**
 * A página inteira esqueletada, no desenho de cada tipo de tela: `pagina` (título, texto, palco 7/12 e painel 5/12),
 * `mapa` (o atlas: mapa à esquerda, painel à direita) e `carreira` (a ficha do político: retrato, nome e trajetória).
 */
export function EsqueletoPagina({ variante = 'pagina', rotulo = 'Abrindo a página...' }: { variante?: 'pagina' | 'mapa' | 'carreira'; rotulo?: string }) {
  useEffect(() => {
    ultimoEsqueleto = Date.now()
    return () => { ultimoEsqueleto = Date.now() }
  }, [])
  if (variante === 'mapa')
    return (
      <div className="mx-auto grid max-w-[var(--casca-max)] gap-8 px-4 pt-6 md:px-[var(--casca-margem)] lg:grid-cols-12">
        <Aviso rotulo={rotulo} />
        <div className="esqueleto-palco h-[58dvh] rounded-[20px] lg:col-span-7 lg:h-[calc(100dvh-140px)]" />
        <div className="grid content-start gap-5 lg:col-span-5">
          <Osso className="h-9 w-3/4 rounded-lg" />
          <Linhas n={2} />
          <Osso className="h-28 rounded-2xl" />
          <Linhas n={4} />
        </div>
      </div>
    )
  if (variante === 'carreira')
    return (
      <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-16 pt-10 md:px-[var(--casca-margem)]">
        <Aviso rotulo={rotulo} />
        <div className="flex gap-6">
          <Osso className="h-[185px] w-[148px] shrink-0 rounded-[14px]" />
          <div className="grid flex-1 content-start gap-3 pt-2">
            <Osso className="h-10 w-2/3 rounded-lg" />
            <Osso className="h-4 w-1/3 rounded-full" />
            <Osso className="mt-2 h-8 w-40 rounded-md" />
          </div>
        </div>
        <Osso className="mt-12 h-6 w-48 rounded-lg" />
        <Osso className="mt-5 h-48 rounded-2xl" />
      </div>
    )
  return (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-16 pt-8 md:px-[var(--casca-margem)] md:pt-12">
      <Aviso rotulo={rotulo} />
      <Osso className="h-12 w-[min(36rem,85%)] rounded-xl" />
      <Linhas n={2} className="mt-6 max-w-[40rem]" />
      <div className="mt-9 grid gap-x-12 gap-y-9 lg:grid-cols-12">
        <div className="esqueleto-palco h-[clamp(380px,calc(100dvh-300px),720px)] rounded-[20px] lg:col-span-7" />
        <div className="grid content-start gap-6 lg:col-span-5">
          <Osso className="h-16 w-2/3 rounded-xl" />
          <Linhas n={3} />
          <Osso className="h-11 w-44 rounded-full" />
          <Linhas n={4} />
        </div>
      </div>
    </div>
  )
}
