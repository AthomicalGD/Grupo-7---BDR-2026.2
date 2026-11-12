/** Estados escolhidos a partir de "PI,BA" na URL (vazio = todos). */
export const ufsDe = (uf?: string): string[] => (uf ? uf.split(',').filter(Boolean) : [])
