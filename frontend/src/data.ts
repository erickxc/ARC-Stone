export type Status = 'Gerando' | 'Planejando' | 'Enviado' | 'Aprovado' | 'Perdido'

export const quotes = [
  { id: 'ORC-0412', project: 'Apto Vila Madalena', client: 'Studio Aroeira', status: 'Aprovado' as Status, value: 248900, date: '12/09', owner: 'R' },
  { id: 'ORC-0411', project: 'Escritório Faria Lima', client: 'Incorporadora Ventura', status: 'Enviado' as Status, value: 1120400, date: '28/09', owner: 'R' },
  { id: 'ORC-0409', project: 'Casa Ibiúna — marcenaria', client: 'Cissa Bueno', status: 'Planejando' as Status, value: 96150, date: '03/09', owner: 'C' },
  { id: 'ORC-0408', project: 'Cobertura Higienópolis', client: 'Ana Prado', status: 'Gerando' as Status, value: 74300, date: 'rev. 01', owner: 'J' },
  { id: 'ORC-0415', project: 'Studio Perdizes', client: 'Bruno Sá', status: 'Gerando' as Status, value: 51900, date: 'SYNC', owner: 'R' },
  { id: 'ORC-0414', project: 'Clínica Itaim', client: 'Grupo Norte', status: 'Planejando' as Status, value: 188400, date: '18/09', owner: 'R' },
  { id: 'ORC-0413', project: 'Cobertura Higienópolis — marcenaria', client: 'Ana Prado', status: 'Enviado' as Status, value: 54400, date: 'PORTAL', owner: 'C' },
  { id: 'ORC-0402', project: 'Hotel boutique Santa Cecília', client: 'Incorporadora Ventura', status: 'Aprovado' as Status, value: 417600, date: 'em produção', owner: 'C' },
  { id: 'ORC-0404', project: 'Loja Pinheiros', client: 'Grupo Norte', status: 'Perdido' as Status, value: 312000, date: 'PREÇO', owner: 'J' },
]

export const money = (value: number) => value.toLocaleString('pt-BR')
