import {
  ArrowsClockwise, BaseballCap, Balloon, BookOpen, Briefcase, Camera, Confetti, CowboyHat, Crown, Detective, Eyeglasses, Flag, Gavel,
  GraduationCap, HandFist, HandWaving, HardHat, Heart, Lightbulb, Lightning, MaskHappy, Medal, Megaphone, Microphone, MusicNotes,
  PaintBrush, Play, PersonArmsSpread, PersonSimpleTaiChi, Prohibit, Rocket, Shuffle, Signpost, Smiley, SmileySad, SoccerBall, Sparkle, Sun,
  Sunglasses, Trophy, TShirt, X, type Icon,
} from '@phosphor-icons/react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Politico } from '../api'
import { Retrato } from '../componentes/Retrato'
import { nomeProprio } from '../lib/formato'
import { Bonequinho } from './Bonequinho'
import { ANIMACOES, CHAPEUS, CORES, NA_MAO, OCULOS, ROSTOS, ROUPAS, despir, sortear, type Visual } from './pecas'

const Bonequinho3D = lazy(() => import('./Bonequinho3D'))

// cada peça com o seu ícone (Phosphor); as gavetas na ordem em que se veste
const ICONES: Record<string, Icon> = {
  foto: Camera, desenho: Smiley,
  nenhum: Prohibit, cartola: Detective, bone: BaseballCap, coroa: Crown, cangaceiro: CowboyHat, palha: Sun, panama: CowboyHat, capacete: HardHat, festa: Confetti, formatura: GraduationCap,
  leitura: Eyeglasses, aviador: Sunglasses, escuros: Sunglasses, coracao: Heart,
  padrao: TShirt, terno: Briefcase, presidiario: Gavel, selecao: SoccerBall, astronauta: Rocket, super: Lightning,
  nada: Prohibit, bandeira: Flag, trofeu: Trophy, microfone: Microphone, constituicao: BookOpen, plaquinha: Signpost, megafone: Megaphone, balao: Balloon,
  auto: Sparkle, acena: HandWaving, danca: MusicNotes, pula: PersonArmsSpread, gira: ArrowsClockwise, comemora: HandFist, discursa: Megaphone,
  pensa: Lightbulb, alonga: PersonSimpleTaiChi, cabisbaixo: SmileySad,
  faixa: Medal, bigode: MaskHappy, chuva: Confetti,
}
type Gaveta = 'rosto' | 'cor' | 'chapeu' | 'oculos' | 'roupa' | 'mao' | 'extras' | 'animacao'
const GAVETAS: { id: Gaveta; nome: string; icone: Icon }[] = [
  { id: 'rosto', nome: 'Rosto', icone: Smiley }, { id: 'cor', nome: 'Cores', icone: PaintBrush }, { id: 'chapeu', nome: 'Chapéus', icone: Detective }, { id: 'oculos', nome: 'Óculos', icone: Eyeglasses },
  { id: 'roupa', nome: 'Roupas', icone: TShirt }, { id: 'mao', nome: 'Na mão', icone: Flag }, { id: 'extras', nome: 'Extras', icone: Medal },
  { id: 'animacao', nome: 'Danças', icone: MusicNotes },
]
const OPCOES = { rosto: ROSTOS, chapeu: CHAPEUS, oculos: OCULOS, roupa: ROUPAS, mao: NA_MAO, animacao: ANIMACOES } as const

function Peca({ nome, icone: I, ativo, cor, tinta, aoClicar }: { nome: string; icone: Icon; ativo: boolean; cor: string; tinta: string; aoClicar: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={`armario-peca flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 p-2 text-center text-[0.78rem] font-semibold leading-tight transition-[transform,background-color,border-color] active:scale-[0.97] ${ativo ? 'shadow-[0_6px_14px_-6px_rgb(18_20_23/0.45)]' : 'border-linha bg-white text-tinta hover:-translate-y-0.5 hover:border-tinta'}`}
      style={ativo ? { background: cor, borderColor: cor, color: tinta } : undefined}
    >
      <I size={30} weight={ativo ? 'fill' : 'duotone'} aria-hidden />
      <span>{nome}</span>
    </button>
  )
}

/** Uma lata de tinta: a cor num círculo grande, que cresce e ganha o anel quando escolhida. */
function Tinta({ nome, cor, ativo, aoClicar }: { nome: string; cor: string; ativo: boolean; aoClicar: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={ativo} onClick={aoClicar} title={nome}
      className="group flex flex-col items-center gap-1.5 text-center text-[0.75rem] font-semibold leading-tight">
      <span className={`block size-12 rounded-full border-[3px] border-tinta transition-transform duration-200 group-hover:-translate-y-0.5 ${ativo ? 'scale-110 ring-4 ring-tinta/25 ring-offset-2 ring-offset-papel' : ''}`}
        style={{ background: cor }} />
      <span className={ativo ? 'text-tinta' : 'text-tinta-2'}>{nome}</span>
    </button>
  )
}

export interface Lado { p: Politico; cor: string; /** a letra em cima da cor */ tinta: string; visual: Visual; faixaPadrao: boolean }

/** O armário: o provador com o bonequinho grande à esquerda e, à direita, as gavetas e a prateleira de peças. */
export function Armario({ lados, inicial, aoMudar, aoFechar }: { lados: Record<'a' | 'b', Lado>; inicial: 'a' | 'b'; aoMudar: (l: 'a' | 'b', v: Visual) => void; aoFechar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [l, setL] = useState(inicial)
  const [gaveta, setGaveta] = useState<Gaveta>('chapeu')
  useEffect(() => { dialogo.current?.showModal() }, [])
  const { p, cor, tinta, visual, faixaPadrao } = lados[l]
  const muda = (o: Partial<Visual>) => aoMudar(l, { ...visual, ...o })
  const faixa = visual.faixa ?? faixaPadrao

  const pecas = gaveta === 'cor' ? [] : gaveta === 'extras'
    ? [
      { k: 'faixa', nome: 'Faixa', ativo: faixa, clique: () => muda({ faixa: !faixa }) },
      { k: 'bigode', nome: 'Bigode', ativo: visual.bigode, clique: () => muda({ bigode: !visual.bigode }) },
      { k: 'chuva', nome: 'Chuva de votos', ativo: visual.chuva, clique: () => muda({ chuva: !visual.chuva, toca: visual.toca + 1 }) },
    ]
    : Object.entries(OPCOES[gaveta]).map(([k, nome]) => ({
      k, nome: nome as string, ativo: visual[gaveta] === k,
      clique: () => muda(gaveta === 'animacao' ? { animacao: k as Visual['animacao'], toca: visual.toca + 1 } : { [gaveta]: k } as Partial<Visual>),
    }))

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      onClick={(e) => e.target === dialogo.current && dialogo.current?.close()}
      aria-label="Armário dos bonequinhos"
      className="armario m-auto max-h-[94dvh] w-[min(1120px,96vw)] overflow-auto rounded-[22px] border-[3px] border-tinta bg-papel p-0 text-tinta backdrop:bg-tinta/60"
    >
      <div className="flex items-center justify-between gap-4 border-b-[3px] border-tinta px-6 py-4">
        <div>
          <h2 className="t-h1 leading-none">O armário</h2>
          <p className="mt-1.5 text-[0.9rem] text-tinta-2">Vista, troque e faça dançar. Fica salvo: quem abrir os dois de novo encontra a mesma roupa. É brincadeira, não diz nada sobre eles.</p>
        </div>
        <button type="button" onClick={() => dialogo.current?.close()} aria-label="Fechar o armário" className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-tinta bg-white hover:bg-papel-2">
          <X size={20} weight="bold" aria-hidden />
        </button>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* o provador */}
        <div className="flex flex-col max-lg:sticky max-lg:top-0 max-lg:z-10 max-lg:-mx-6 max-lg:-mt-6 max-lg:border-b-[3px] max-lg:border-tinta max-lg:bg-papel max-lg:px-6 max-lg:pb-4 max-lg:pt-6">
          <div role="radiogroup" aria-label="Quem está no provador" className="grid grid-cols-2 gap-2">
            {(['a', 'b'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={l === k} onClick={() => setL(k)}
                className={`flex min-w-0 items-center gap-2.5 rounded-full border-2 p-1.5 pr-4 text-left text-[0.88rem] font-bold transition-colors ${l === k ? '' : 'border-linha bg-white text-tinta hover:border-tinta'}`}
                style={l === k ? { background: lados[k].cor, borderColor: lados[k].cor, color: lados[k].tinta } : undefined}>
                <span className="shrink-0 overflow-hidden rounded-full border-2 border-white"><Retrato foto={lados[k].p.foto} nome={lados[k].p.nome} tamanho={34} /></span>
                <span className="truncate">{nomeProprio(lados[k].p.nome)}</span>
              </button>
            ))}
          </div>
          <div className="provador relative mt-4 grid flex-1 place-items-center overflow-hidden rounded-[18px] border-[3px] border-tinta" style={{ ['--lado' as string]: cor }}>
            <Suspense fallback={<Bonequinho p={p} cor={visual.cor ?? cor} tamanho={180} />}>
              <Bonequinho3D key={l} p={p} cor={cor} lado={l} visual={visual} perto className="aspect-[1/1.15] w-full max-w-[420px] max-lg:h-[30dvh] max-lg:w-auto" />
            </Suspense>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => muda({ toca: visual.toca + 1 })} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.9rem] font-bold" style={{ background: cor, color: tinta }}>
              <Play size={15} weight="fill" aria-hidden /> Tocar a dança
            </button>
            <button type="button" onClick={() => aoMudar(l, sortear(visual))} className="inline-flex items-center gap-1.5 rounded-full border-2 border-tinta bg-white px-4 py-2 text-[0.9rem] font-bold">
              <Shuffle size={15} weight="bold" aria-hidden /> Sortear tudo
            </button>
            <button type="button" onClick={() => aoMudar(l, despir(visual))} className="inline-flex items-center gap-1.5 rounded-full border-2 border-linha bg-white px-4 py-2 text-[0.9rem] font-bold text-tinta-2 hover:border-tinta">
              Tirar tudo
            </button>
          </div>
        </div>

        {/* o móvel: portas que abrem, gavetas e a prateleira */}
        <div className="armario-movel relative rounded-[18px] border-[3px] border-tinta bg-[#eef2f8]">
          <div className="armario-cornija rounded-t-[15px]" aria-hidden />
          <div className="grid grid-cols-[164px_minmax(0,1fr)] max-sm:grid-cols-1">
            <div role="tablist" aria-label="Gavetas" aria-orientation="vertical" className="flex flex-col gap-2 border-r-[3px] border-tinta bg-[#dfe6f2] p-3 max-sm:flex-row max-sm:overflow-x-auto max-sm:border-b-[3px] max-sm:border-r-0">
              {GAVETAS.map(({ id, nome, icone: I }) => (
                <button key={id} type="button" role="tab" aria-selected={gaveta === id} onClick={() => setGaveta(id)}
                  className={`gaveta flex shrink-0 items-center gap-2 rounded-[10px] border-2 border-tinta px-3 py-2.5 text-left text-[0.86rem] font-bold transition-transform ${gaveta === id ? 'translate-x-1.5 bg-white max-sm:translate-x-0 max-sm:-translate-y-0.5' : 'bg-[#c9d4e8] hover:translate-x-0.5'}`}>
                  <I size={18} weight="bold" aria-hidden />
                  <span className="flex-1 whitespace-nowrap">{nome}</span>
                  <span className="h-1.5 w-4 rounded-full bg-tinta max-sm:hidden" aria-hidden />
                </button>
              ))}
            </div>
            <div role="tabpanel" aria-label={GAVETAS.find((g) => g.id === gaveta)!.nome} className="prateleira p-4">
              {gaveta === 'cor' && (
                <div role="radiogroup" aria-label="Cor do bonequinho" className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-3 pb-2">
                  <Tinta nome={`Do lado (${l === 'a' ? 'azul' : 'amarelo'})`} cor={cor} ativo={!visual.cor} aoClicar={() => muda({ cor: null })} />
                  {CORES.filter((c) => c.cor !== cor).map((c) => <Tinta key={c.cor} nome={c.nome} cor={c.cor} ativo={visual.cor === c.cor} aoClicar={() => muda({ cor: c.cor })} />)}
                </div>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] max-sm:grid-cols-3 gap-x-3 gap-y-6 pb-2">
                {pecas.map((x) => <Peca key={x.k} nome={x.nome} icone={ICONES[x.k] ?? Sparkle} ativo={x.ativo} cor={cor} tinta={tinta} aoClicar={x.clique} />)}
              </div>
              {gaveta === 'rosto' && !p.foto && <p className="mt-3 text-[0.85rem] text-tinta-3">Sem foto no TSE: o rosto fica desenhado.</p>}
              {gaveta === 'animacao' && <p className="mt-3 text-[0.85rem] text-tinta-3">A dança toca ao escolher, no "Tocar a dança" e com o mouse em cima do bonequinho.</p>}
            </div>
          </div>
          {/* as portas: abrem uma vez quando o armário aparece */}
          <div className="armario-portas pointer-events-none absolute inset-0 overflow-hidden rounded-[15px]" aria-hidden>
            <div className="armario-porta armario-porta-e"><span className="armario-puxador" /></div>
            <div className="armario-porta armario-porta-d"><span className="armario-puxador" /></div>
          </div>
        </div>
      </div>
    </dialog>
  )
}
