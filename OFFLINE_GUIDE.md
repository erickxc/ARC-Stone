# Guia de Uso: Modo Offline e PWA - Dilegno ERP

O Dilegno ERP foi projetado para continuar funcionando mesmo se a conexão de internet da marcenaria cair, garantindo que o seu fluxo de trabalho não seja interrompido.

## Como Funciona?

### 1. Aplicativo Instalável (PWA)
Você pode instalar o Dilegno ERP no seu computador, tablet ou celular.
- **No Chrome (Computador):** Acesse o sistema e clique no ícone de "Instalar aplicativo" na barra de endereços (lado direito).
- **No Celular (iOS/Android):** Acesse no Safari ou Chrome e escolha a opção "Adicionar à Tela de Início".
- **Vantagem:** O aplicativo carregará instantaneamente, independentemente da qualidade da internet.

### 2. O que acontece quando a internet cai?
Uma barra de aviso aparecerá no topo do sistema informando: **"Você está offline. Trabalhando com os dados do cache local."**
Neste momento, você entra no modo de cache local (IndexedDB).

### 3. Ações Permitidas Offline
- **Consultar Estoque e Catálogo:** Você pode visualizar todos os produtos, preços e quantidades.
- **Movimentar Estoque:** Você pode registrar ENTRADA ou SAÍDA de peças no galpão.
  - *O sistema salvará a movimentação na "Fila Pendente" (ícone no topo) e fará a baixa no servidor assim que a conexão voltar.*
- **Consultar Clientes:** Você pode visualizar a sua carteira de clientes, e-mails, telefones e endereços.
- **Consultar Orçamentos (CRM):** Você pode visualizar o estágio de cada proposta de venda.

### 4. Ações Bloqueadas Offline (Exigem Conexão)
Para manter a integridade dos dados, algumas ações são bloqueadas sem internet:
- **Arrastar Orçamentos de coluna (Aprovar/Negar):** Bloqueado para evitar que 2 vendedores alterem o mesmo orçamento ao mesmo tempo com o sistema fora do ar.
- **Cadastrar Novos Produtos/Clientes.**
- **Upload de Fotos (Galpão ou Referências).**
- **Gerar PDFs de Orçamento.**
- **Excluir ou Demitir Funcionários.**

## Segurança em Múltiplos Dispositivos (Conflitos)

Se você estiver offline e fizer uma saída de estoque de uma peça de MDF, e um colega em outro celular fizer uma saída da mesma peça ao mesmo tempo, o que acontece?

O sistema possui uma trava de segurança otimista (`version_id`). Quando a internet voltar, o sistema sincronizará os dados. Se ele detectar que a peça já foi alterada por outro usuário, você receberá um aviso de **Conflito de concorrência**. Basta recarregar a página para ver o estoque real mais atualizado.

## Dúvidas Comuns

**"Os dados vão lotar a memória do meu celular?"**
Não. O sistema limpa automaticamente caches com mais de 7 dias, mantendo a memória leve e otimizada para performance.
