// As consultas SQL por trás dos gráficos (as mesmas da Metodologia): "Ver SQL" mostra a de cada um.
import p10Carreira from '../paginas/consultas/p10_carreira.sql?raw'
import p10Reeleicao from '../paginas/consultas/p10_reeleicao.sql?raw'
import p12SegundoTurno from '../paginas/consultas/p12_segundo_turno.sql?raw'
import p1Campanha from '../paginas/consultas/p1_campanha.sql?raw'
import p1Gasto from '../paginas/consultas/p1_gasto.sql?raw'
import p2Patrimonio from '../paginas/consultas/p2_patrimonio.sql?raw'
import p4Chance from '../paginas/consultas/p4_chance.sql?raw'
import p4Lugar from '../paginas/consultas/p4_lugar.sql?raw'
import p4Votos from '../paginas/consultas/p4_votos.sql?raw'
import p7Vies from '../paginas/consultas/p7_vies.sql?raw'
import p7VotosPartido from '../paginas/consultas/p7_votos_partido.sql?raw'

export const SQL = {
  p1Campanha, p1Gasto, p2Patrimonio, p4Chance, p4Lugar, p4Votos, p7Vies, p7VotosPartido, p10Carreira, p10Reeleicao, p12SegundoTurno,
} as const

export type ConsultaSql = keyof typeof SQL
