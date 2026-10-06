import type { ReactNode } from 'react'

function Secao({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-linha py-10 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-12">
      <h2 id={id} className="t-h2">{titulo}</h2>
      <div className="max-w-[68ch] space-y-4 leading-relaxed text-tinta-2 [&_b]:text-tinta [&_code]:t-mono [&_code]:rounded [&_code]:bg-papel-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:text-tinta">
        {children}
      </div>
    </section>
  )
}

export function Metodologia() {
  return (
    <article className="mx-auto max-w-[1440px] px-4 pt-12 md:px-[72px]">
      <header className="max-w-[60ch] pb-10">
        <h1 className="t-display">Como os números são feitos</h1>
        <p className="mt-5 text-[1.1rem] leading-relaxed text-tinta-2">
          Tudo aqui sai de dados abertos baixados, modelados e carregados pelo grupo. Nada é estimado à mão: cada número
          pode ser refeito com os comandos do repositório.
        </p>
      </header>

      <Secao id="m-vies" titulo="Viés político (P7)">
        <p>
          Cada partido tem um viés de <b>−100 (esquerda)</b> a <b>+100 (direita)</b>, a partir da classificação de
          especialistas de Bolognesi, Codato, Ribeiro e Silva (Harvard Dataverse). O viés de um município num ano é a média
          desses vieses <b>ponderada pelos votos válidos</b> (nominais e de legenda) que cada partido recebeu ali, somando
          todos os cargos do 1º turno.
        </p>
        <p className="rounded-xl border border-linha bg-folha px-5 py-4 text-tinta">
          viés do município = Σ (votos válidos do partido × viés do partido) ÷ Σ votos válidos
        </p>
        <p>Estados e regiões intermediárias usam a mesma média sobre os votos de todos os seus municípios.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>2018 e 2022 somam presidente, governador, senado e deputados; 2020 e 2024, prefeito e vereador. Compare anos do mesmo tipo.</li>
          <li>Em 2018 cada eleitor tinha dois votos para o Senado, então o Senado pesa o dobro nesse ano.</li>
          <li>Partidos sem viés informado entram como 0 e puxam a média para o centro; cada boletim mostra a parcela desses votos.</li>
          <li>Partidos extintos herdam o viés de quem os sucedeu (fusões e incorporações).</li>
        </ul>
      </Secao>

      <Secao id="m-carreira" titulo="Carreira do político (P10)">
        <p>
          A pessoa é identificada entre eleições pelo <b>título eleitoral</b>; sem ele, pelo CPF; sem os dois, por nome e
          data de nascimento. As candidaturas vão de 1994 a 2024.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Reeleição:</b> eleito para o mesmo cargo, na mesma UF ou município, na eleição ordinária anterior (quatro anos antes; oito para senador).</li>
          <li><b>Votos:</b> nominais do 1º turno, disponíveis de 2018 a 2024 nos estados carregados.</li>
          <li><b>Partido:</b> conhecido nos mandatos; candidaturas não eleitas aparecem sem partido.</li>
          <li><b>Privacidade:</b> CPF, título eleitoral e data completa de nascimento nunca aparecem; só o ano.</li>
          <li><b>Fotos:</b> as fotos de registro que o TSE publica desde 2004.</li>
        </ul>
      </Secao>

      <Secao id="m-fontes" titulo="Fontes">
        <ul className="space-y-2">
          <li><b>TSE, Portal de Dados Abertos:</b> candidaturas, votação por município e zona, comparecimento, fotos.</li>
          <li><b>IBGE:</b> malhas municipais (GeoJSON), PIB municipal, estimativas de população e Censo 2022.</li>
          <li><b>Atlas Brasil (PNUD, Ipea, FJP):</b> IDHM; o mais recente é o do Censo 2010.</li>
          <li><b>Harvard Dataverse:</b> classificação ideológica dos partidos.</li>
        </ul>
      </Secao>

      <Secao id="m-limites" titulo="Limitações">
        <ul className="list-disc space-y-2 pl-5">
          <li>Só os estados carregados no banco têm viés; os demais aparecem hachurados como <i>sem dados carregados</i>.</li>
          <li>O viés mede o voto em partidos, não a opinião dos eleitores.</li>
          <li>Nomes vêm do registro civil no TSE, em maiúsculas e às vezes sem acento.</li>
          <li>Este é um projeto acadêmico; não é um site oficial da Justiça Eleitoral.</li>
        </ul>
      </Secao>

      <Secao id="m-reproduzir" titulo="Para reproduzir">
        <ol className="list-decimal space-y-2 pl-5">
          <li><code>python -m crawler</code> baixa os dados; <code>python -m crawler --fotos</code>, as fotos.</li>
          <li><code>docker compose up -d</code> sobe o PostgreSQL e aplica as migrações.</li>
          <li><code>python -m loader PI BA</code> carrega os estados.</li>
          <li><code>python -m uvicorn api.app:app --port 8000</code> sobe a API.</li>
          <li><code>npm run dev</code> na pasta <code>web</code> abre este site.</li>
        </ol>
      </Secao>
    </article>
  )
}
