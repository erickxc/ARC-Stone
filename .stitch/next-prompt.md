---
page: logs
---
Logs de Auditoria.

**DESIGN SYSTEM (REQUIRED):**
---
name: Organic Minimalism
colors:
  surface: '#fcf9ef'
  surface-dim: '#dcdad1'
  surface-bright: '#fcf9ef'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f4ea'
  surface-container: '#f0eee4'
  surface-container-high: '#eae8de'
  surface-container-highest: '#e4e3d9'
  on-surface: '#1b1c16'
  on-surface-variant: '#484740'
  inverse-surface: '#30312a'
  inverse-on-surface: '#f3f1e7'
  outline: '#79776f'
  outline-variant: '#cac6bd'
  surface-tint: '#605e5d'
  primary: '#191918'
  on-primary: '#ffffff'
  primary-container: '#2e2d2c'
  on-primary-container: '#979492'
  inverse-primary: '#c9c6c4'
  secondary: '#536255'
  on-secondary: '#ffffff'
  secondary-container: '#d4e4d3'
  on-secondary-container: '#576659'
  tertiary: '#191919'
  on-tertiary: '#ffffff'
  tertiary-container: '#2e2d2d'
  on-tertiary-container: '#979494'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e6e2e0'
  primary-fixed-dim: '#c9c6c4'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#484645'
  secondary-fixed: '#d7e7d6'
  secondary-fixed-dim: '#bbcbbb'
  on-secondary-fixed: '#111e14'
  on-secondary-fixed-variant: '#3c4a3e'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c9c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#484646'
  background: '#fcf9ef'
  on-background: '#1b1c16'
  surface-variant: '#e4e3d9'
  sombra: '#2E2D2C'
  eucalipto: '#B2C2B2'
  lino: '#F5F3E9'
  lienzo: '#EBEBEB'
typography:
  headline-xl:
    fontFamily: Source Sans 3
    fontSize: 64px
    fontWeight: '700'
    lineHeight: 72px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Source Sans 3
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Source Sans 3
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Source Sans 3
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Source Sans 3
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  body-lg:
    fontFamily: Source Sans 3
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 32px
  body-md:
    fontFamily: Source Sans 3
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Source Sans 3
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  caption:
    fontFamily: Source Sans 3
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 64px
  container-max: 1280px
  gutter: 24px
---

**PLATFORM:** Web, Desktop-first

**PAGE STRUCTURE:**
1. **Header:** Sticky navigation bar with standard components.
2. **Page Header:** Title "Logs de Auditoria". Search input with placeholder "Pesquisar por descrição, ação ou usuário...".
3. **Primary Content Area:** 
   - **Chronological List:** A modern timeline or list view showing recent audit logs.
   - **Log Entry Structure:**
     - Data/Hora: "14 Jun 2026 10:30".
     - Badge de ação: Criação (green/Eucalipto), Edição (gold/Wood), Status (blue), Exclusão (red/Terracotta).
     - Feito por: "Ricardo Alencar".
     - Entidade: "Orçamento #ORC-0001".
     - Descrição: "Status alterado de Gerando para Planejando".
   - Use clean spacing, `Lienzo` dividers, and `Source Sans 3` typography.
