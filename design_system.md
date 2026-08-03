# Design System – Dilegno Móveis (Atualizado - Branding Àndale)

## Inspiração Visual

O design do sistema reflete a nova identidade visual da Dilegno. A estética foca em minimalismo orgânico, elegância e clareza, utilizando tons suaves e neutros em contraste com elementos escuros (Sombra).

- **Palavras-chave**: *Vestindo espaços*, *Design Minimalista*, *Resistência e Sofisticação*
- **Cores principais**: Lino (fundo principal), Eucalipto (acento primário), Sombra (texto e elementos de destaque).
- **Tipografia**: O sistema utiliza a família tipográfica **Source Sans 3** em todos os elementos (textos e títulos).

---

## Paleta de Cores

Abaixo estão as cores oficiais definidas na configuração do Tailwind (`tailwind.config.js`):

| Nome        | Código HEX   | Uso principal                                          |
|-------------|--------------|--------------------------------------------------------|
| **Sombra**  | `#2E2D2C`    | Textos principais, ícones, elementos de forte contraste|
| **Eucalipto**| `#B2C2B2`    | Destaques, Navbar (upbar), hover states, badges        |
| **Lino**    | `#F5F3E9`    | Fundo principal da aplicação (background)              |
| **Lienzo**  | `#EBEBEB`    | Fundo secundário, divisórias suaves                    |
| **Terracota**| `#A85A46`   | Alertas e mensagens de erro (desaturado)               |

*Nota: As classes legadas (wood, moss, sand, gold, nobleGray) foram mapeadas para as novas cores para evitar quebras de interface.*

### Exemplo de aplicação no Tailwind

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        sombra: '#2E2D2C',
        eucalipto: '#B2C2B2',
        lino: '#F5F3E9',
        lienzo: '#EBEBEB',
        terracotta: '#A85A46',
      }
    }
  }
}
```

## Tipografia

Todo o sistema unificou a tipografia para utilizar a família **Source Sans 3**.

| Elemento          | Fonte           | Peso  | Aplicação                           |
|-------------------|-----------------|-------|-------------------------------------|
| **Títulos**       | Source Sans 3   | Bold  | Nomes de telas, Dashboard           |
| **Subtítulos**    | Source Sans 3   | Semi  | Cabeçalhos de seção, Cards          |
| **Corpo de texto**| Source Sans 3   | Normal| Tabelas, parágrafos, formulários    |
| **Botões**        | Source Sans 3   | Medium| Chamadas para ação (uppercase)      |

---

## Componentes UI e Padrões Atuais

### Navbar (Upbar) Superior
- **Fundo**: `bg-eucalipto/90` com efeito `backdrop-blur-md`.
- **Comportamento**: Fixa no topo (`sticky top-0`) e sombra leve (`shadow-sm`).
- **Logo**: Logotipo "Dilegno" ajustado no lado esquerdo (`h-8 lg:h-10`).
- **Elementos direitos**: Status offline/sync, avatar do usuário (`bg-lino` / texto `sombra`), botão Sair.

### Tela de Login
- **Fundo**: `bg-eucalipto`
- **Ilustrações**: Elementos visuais (`DILEGNO_ILUS`) aplicados como marca d'água posicionados nas extremidades da tela.
- **Formulário**: Textos de rótulo em `sombra`, inputs com borda arredondada (`rounded-full`) transparente com borda `sombra/40`.
- **Botão Primário de Login**: Borda fina `sombra/40`, texto em `sombra`. Ao realizar *hover*, fundo muda para `sombra` e texto para branco.

### Menus de Navegação (Desktop & Mobile)
- **Desktop**: Links na própria Upbar agrupados por contexto, exibindo menus dropdown flutuantes com fundo branco.
- **Mobile (Menu Hambúrguer)**: 
  - Drawer abrindo pela direita.
  - Títulos de grupo em `text-eucalipto` (tamanho reduzido, uppercase).
  - Ítens ativos marcados com fundo `bg-eucalipto/10` e texto em `eucalipto`.

### Botões Padrão (App Interno)
- **Cores base**: Tipicamente fundos claros com texto `sombra`, ou bordas `sombra/40` que escurecem no hover.
- **Formato**: Maioria com arredondamentos estilo `rounded-lg` a `rounded-full` para botões mais orgânicos.

---

## Elementos Gráficos (Assets)

1. **Logo / Logotipo**: `DILEGNO_LOGOTIPO-1.P.png` (usado na Navbar).
2. **Selo**: `DILEGNO_SELLO.P.png` (marca centralizada, muito usada na tela de login).
3. **Ilustrações**: Padrões visuais (como as cadeiras / móveis) inseridas com opacidade reduzida e inclinação (rotate) para gerar dinamismo na UI.