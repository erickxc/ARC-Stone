export type Status = 'Gerando' | 'Planejando' | 'Enviado' | 'Ajuste' | 'Aprovado' | 'Perdido'

/** Valores monetários circulam em centavos (inteiros), como no backend. */
export const money = (centavos: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100)
