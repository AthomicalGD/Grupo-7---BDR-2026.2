import { useId, useState } from 'react'
import type { Politico } from '../api'

/**
 * Um bonequinho de cada candidato, montado só com os dados (não é retrato):
 * cabelo pela idade, faixa se venceu para o executivo (senão gravata),
 * o número da urna no peito, sorriso e braço erguido se venceu a última eleição,
 * e o partido no pedestal. Com a foto do TSE, ela é o rosto; sem foto, o rosto é amarelo de brinquedo
 * de propósito: não chuta a aparência de ninguém.
 */
export const TINTA = '#121417'
export const ROSTO = '#fde7a1'

/** Os traços que os dois bonequinhos (o desenho e o 3D) tiram dos dados. */
export function tracos(p: Politico, cor: string) {
  const cs = p.candidaturas.filter((c) => !c.suplementar).sort((x, y) => x.ano - y.ano)
  const ultima = cs.at(-1)
  const venceu = !!ultima?.eleito
  const cargo = ultima?.cargo ?? ''
  const idade = p.nascimento_ano ? 2024 - p.nascimento_ano : null
  // o cabelo grisalha com a idade: escuro até 44, mesclado até 59, grisalho até 69, branco depois
  const cabelo = idade == null || idade < 45 ? '#3a2a1e' : idade < 60 ? '#6b5d52' : idade < 70 ? '#a2a8b0' : '#e6e9ec'
  const faixa = !venceu ? null : cargo === 'PRESIDENTE' ? ['#009c3b', '#f5b800'] : cargo === 'GOVERNADOR' || cargo === 'PREFEITO' ? ['#ffffff', cor] : null
  return { ultima, venceu, cargo, idade, cabelo, faixa, mulher: p.genero === 'feminino' }
}

export function Bonequinho({ p, cor, tamanho = 120 }: { p: Politico; cor: string; tamanho?: number }) {
  const { ultima, venceu, cabelo, faixa } = tracos(p, cor)
  const penteado = p.id % 4
  const clip = useId()
  const [falhou, setFalhou] = useState(false)
  const foto = p.foto && !falhou ? p.foto : null

  return (
    <svg viewBox="0 0 120 170" width={tamanho} height={(tamanho * 170) / 120} role="img" aria-label={`Bonequinho de ${p.nome}`} className="transition-transform duration-200 group-hover:-translate-y-1">
      <g stroke={TINTA} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
        {/* pedestal com o partido */}
        <rect x={22} y={146} width={76} height={20} rx={10} fill="#fff" />
        {/* pernas */}
        <rect x={42} y={118} width={15} height={30} rx={6} fill="#2f3846" />
        <rect x={63} y={118} width={15} height={30} rx={6} fill="#2f3846" />
        {/* braços: o de fora sobe quando venceu */}
        <rect x={20} y={76} width={14} height={40} rx={7} fill={cor} />
        {venceu
          ? <rect x={86} y={44} width={14} height={40} rx={7} fill={cor} transform="rotate(28 93 80)" />
          : <rect x={86} y={76} width={14} height={40} rx={7} fill={cor} />}
        {/* corpo */}
        <rect x={30} y={70} width={60} height={56} rx={18} fill={cor} />
      </g>
      {/* gola e gravata ou faixa */}
      <path d="M50 71 L60 84 L70 71 Z" fill="#fff" stroke={TINTA} strokeWidth={2} strokeLinejoin="round" />
      {faixa ? (
        <g>
          <path d="M33 80 L42 74 L88 116 L80 122 Z" fill={faixa[0]} stroke={TINTA} strokeWidth={2} strokeLinejoin="round" />
          <path d="M37 78 L84 119" stroke={faixa[1]} strokeWidth={3} />
        </g>
      ) : (
        <path d="M57 84 L63 84 L65 104 L60 110 L55 104 Z" fill={TINTA} />
      )}
      {/* número da urna no peito */}
      {ultima?.numero != null && (
        <g>
          <circle cx={faixa ? 46 : 74} cy={104} r={11} fill="#fff" stroke={TINTA} strokeWidth={2} />
          <text x={faixa ? 46 : 74} y={108} textAnchor="middle" fontSize={String(ultima.numero).length > 2 ? 8 : 11} fontWeight={800} fill={TINTA} style={{ fontFamily: 'var(--font-display)' }}>
            {ultima.numero}
          </text>
        </g>
      )}
      {foto ? (
        <g>
          <defs><clipPath id={clip}><circle cx={60} cy={42} r={27} /></clipPath></defs>
          <circle cx={60} cy={42} r={27} fill={ROSTO} />
          <image href={foto} x={30} y={10} width={60} height={80} preserveAspectRatio="xMidYMin slice" clipPath={`url(#${clip})`} onError={() => setFalhou(true)} />
          <circle cx={60} cy={42} r={27} fill="none" stroke={TINTA} strokeWidth={3} />
        </g>
      ) : (
        <>
          {/* cabeça */}
          {penteado === 2 && <circle cx={60} cy={14} r={9} fill={cabelo} stroke={TINTA} strokeWidth={3} />}
          <circle cx={60} cy={44} r={25} fill={ROSTO} stroke={TINTA} strokeWidth={3} />
          {penteado === 0 && <path d="M35 42 Q36 18 60 18 Q84 18 85 42 Q74 30 60 31 Q46 30 35 42 Z" fill={cabelo} stroke={TINTA} strokeWidth={3} strokeLinejoin="round" />}
          {penteado === 1 && <path d="M35 44 Q34 18 62 18 Q86 20 85 40 Q70 26 52 34 Q42 36 35 44 Z" fill={cabelo} stroke={TINTA} strokeWidth={3} strokeLinejoin="round" />}
          {penteado === 2 && <path d="M36 40 Q40 19 60 19 Q80 19 84 40 Q72 28 60 28 Q48 28 36 40 Z" fill={cabelo} stroke={TINTA} strokeWidth={3} strokeLinejoin="round" />}
          {penteado === 3 && (
            <g fill={cabelo} stroke={TINTA} strokeWidth={3}>
              {[[40, 32], [48, 23], [60, 20], [72, 23], [80, 32]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={9} />)}
            </g>
          )}
          {/* rosto */}
          <circle cx={51} cy={47} r={2.8} fill={TINTA} />
          <circle cx={69} cy={47} r={2.8} fill={TINTA} />
          {venceu
            ? <path d="M50 56 Q60 65 70 56" fill="none" stroke={TINTA} strokeWidth={3} strokeLinecap="round" />
            : <path d="M52 59 L68 59" stroke={TINTA} strokeWidth={3} strokeLinecap="round" />}
          <circle cx={45} cy={55} r={3.5} fill="#f5a49a" opacity={0.7} />
          <circle cx={75} cy={55} r={3.5} fill="#f5a49a" opacity={0.7} />
        </>
      )}
      {/* partido no pedestal */}
      <text x={60} y={160} textAnchor="middle" fontSize={11} fontWeight={800} fill={cor} style={{ fontFamily: 'var(--font-display)' }}>
        {ultima?.partido ?? ''}
      </text>
    </svg>
  )
}
