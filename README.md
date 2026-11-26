# TourWise

Aplicação de turismo com três perfis: Administrador (`adm`), Gestor (`Gestor`) e
Agente (`Agente`).

## Banco de dados

`src/database/script-tabelas.sql` cria o esquema baseado em `empresa`, `usuario` e
`tipo_usuario`. O fluxo usa `usuario.nome`, `localizacao.fk_hospedagem` e os campos de
pesquisa/recomendação definidos no script. Em instalação nova, execute o script
completo uma vez. Em uma instalação existente, execute
`src/database/migrations/20261126_historico_recomendacoes.sql` uma vez antes de
iniciar a aplicação atualizada.

Os registros de demonstração devem ser criados manualmente usando os tipos
`adm`, `Gestor` e `Agente`. Um usuário Administrador tem `fk_empresa = NULL`; Gestor
e Agente devem referenciar a empresa correspondente em `fk_empresa`. Não mantenha
senhas de teste neste repositório.

As senhas seguem o formato atual do projeto e são armazenadas em texto simples;
isso é adequado apenas para ambiente acadêmico/local, não para produção.

O banco local atualmente configurado deve ter esse esquema antes que o login e as
telas novas funcionem. Este repositório não executa migração automática nem altera
os dados de nenhum banco.

## Fluxo e telas

- **Administrador:** `public/administrador.html`; acompanha KPIs e gerencia empresas,
  gestores e administradores em cadastros independentes. Hospedagens não são
  cadastradas nem editadas pela área administrativa.
- **Gestor:** `public/gestor.html`; lista, cadastra, atualiza e exclui Agentes da
  própria empresa, com modais dedicados para inclusão e edição.
- **Agente:** `public/agente.html`; navega e filtra o catálogo, gera recomendações
  e é redirecionado para `public/dashboard/dashboard.html`, que exibe os três hotéis
  mais compatíveis usando as informações da comparação.
  As pesquisas e recomendações ficam no histórico do agente, que permite filtrar
  pelo cliente, favoritar hospedagens, editar e recalcular pesquisas, desativar
  recomendações e consultá-las separadamente na seção de desativadas.

A compatibilidade considera destino (35%), tipo de hospedagem (15%), capacidade
(20%), acessibilidade (20%) e idioma (10%). Critérios opcionais ou sem informação
disponível no cadastro do hotel não são incluídos no denominador.

## API

O login é `POST /usuarios/autenticar`. Envie o token de resposta nas demais
requisições como `Authorization: Bearer <token>`. Sessões expiram após oito horas e
são mantidas em memória; reiniciar o servidor encerra as sessões.

| Perfil | Rotas |
|---|---|
| Público | `POST /usuarios/autenticar` |
| Autenticado | `GET /usuarios/sessao`, `POST /usuarios/sair` |
| Administrador | CRUD `/empresas`, `/gestores` e `/administradores` |
| Gestor | CRUD `/usuarios` (limitado à empresa da sessão) |
| Agente | `GET /hospedagens`, `GET /hospedagens/:id`, `POST /comparacoes`, CRUD do histórico `/recomendacoes` |

`POST /comparacoes` classifica as hospedagens em lotes, persiste os dados da pesquisa
e salva apenas os três melhores resultados. O histórico e as ações de favorito,
edição, desativação e reativação são limitados ao agente autenticado.

Cada CRUD de cadastro oferece `GET /`, `GET /:id`, `POST /`, `PUT /:id` e
`DELETE /:id`.
As rotas validam sessão e perfil no servidor. As listagens de hospedagens,
empresas, gestores, administradores, agentes e recomendações usam `?page=1&limit=10`; o limite máximo por
requisição é dez registros. A resposta da listagem contém `items` e os metadados
`pagination` (`page`, `pageSize`, `total` e `totalPages`). A busca do catálogo de
hospedagens aplica filtros no banco antes de paginar.

## Executar

Configure as variáveis de ambiente em `.env.dev` e inicie com `npm run dev` ou
`npm start`.

No PowerShell do Windows, se a política de execução bloquear `npm.ps1`, use
`npm.cmd run dev` ou `npm.cmd start`.
