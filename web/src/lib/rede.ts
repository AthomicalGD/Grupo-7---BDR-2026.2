// A chave da rede local (npm run rede): chega no endereço como ?chave=..., fica guardada na aba e volta
// no QR code do boletim, para o celular que escanear também entrar. Fora do `npm run rede` não existe.
const CHAVE = 'va_chave'

try {
  const daUrl = new URLSearchParams(window.location.search).get('chave')
  if (daUrl) sessionStorage.setItem(CHAVE, daUrl)
} catch {
  // sem sessionStorage (aba privada bloqueada): o QR sai sem a chave
}

/** O endereço desta página para outro aparelho: o atual, com a chave da rede quando houver. */
export function enderecoParaOutroAparelho(): string {
  const url = new URL(window.location.href)
  try {
    const chave = sessionStorage.getItem(CHAVE)
    if (chave && !url.searchParams.has('chave')) url.searchParams.set('chave', chave)
  } catch {
    // idem
  }
  return url.toString()
}
