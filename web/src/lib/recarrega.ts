// Quando um pedaço carregado sob demanda (as páginas, o 3D) falha ao baixar, a página recarrega sozinha uma vez em vez
// de mostrar "Something went wrong!". Acontece quando o servidor de desenvolvimento reempacota as dependências com a
// página aberta (os módulos ficam apontando para o pacote antigo) ou quando sai uma versão nova do site.
const CHAVE = 'va-recarregou-em'
const FALHA_DE_MODULO = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Outdated Optimize Dep/i

export const ehFalhaDeModulo = (erro: unknown) => FALHA_DE_MODULO.test(String((erro as Error | undefined)?.message ?? erro))

/** Recarrega a página, mas no máximo uma vez a cada 10 s (se a falha persistir, o erro aparece em vez de um laço). */
export function recarregaUmaVez(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(CHAVE) ?? 0) < 10_000) return false
    sessionStorage.setItem(CHAVE, String(Date.now()))
  } catch {
    return false
  }
  location.reload()
  return true
}
