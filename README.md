# TourWise

Aplicação de turismo com três perfis: Administrador (`adm`), Gestor (`Gestor`) e
Agente (`Agente`).

## Banco de dados

`src/database/script-tabelas.sql` cria o esquema baseado em `empresa`, `usuario` e
`tipo_usuario`. O fluxo precisa de `usuario.nome` para identificar as pessoas e de
`localizacao.fk_hospedagem` para relacionar a cidade ao hotel; ambos foram incluídos
no script. `tipo_usuario.tipo_usuario` é único para permitir vínculos confiáveis.
Em instalação nova, execute o script completo uma vez.

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

- **Administrador:** `public/administrador.html`; acompanha KPIs e gerencia empresas
  (criando junto o acesso do Gestor), administradores e hospedagens.
- **Gestor:** `public/gestor.html`; lista, cadastra, atualiza e exclui Agentes da
  própria empresa.
- **Agente:** `public/agente.html`; navega e filtra o catálogo de hospedagens e gera
  recomendações com base nos dados transitórios do cliente. É possível selecionar
  uma hospedagem específica ou comparar com todas; os dados do cliente não são persistidos.

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
| Administrador | CRUD `/agencias`, `/administradores` e `/hospedagens` |
| Gestor | CRUD `/usuarios` (limitado à empresa da sessão) |
| Agente | `GET /hospedagens`, `GET /hospedagens/:id`, `POST /comparacoes` |

Em `POST /comparacoes`, `hospedagemId` é opcional: sem ele, o sistema classifica
todas as hospedagens; com ele, gera a recomendação para a hospedagem selecionada.
Os dados do cliente são transitórios e não são gravados. A análise percorre os
hotéis em lotes no servidor e retorna até dez recomendações por página.

Cada CRUD oferece `GET /`, `GET /:id`, `POST /`, `PUT /:id` e `DELETE /:id`.
As rotas validam sessão e perfil no servidor. As listagens de hospedagens,
agências, administradores e agentes usam `?page=1&limit=10`; o limite máximo por
requisição é dez registros. A resposta da listagem contém `items` e os metadados
`pagination` (`page`, `pageSize`, `total` e `totalPages`). A busca do catálogo de
hospedagens aplica filtros no banco antes de paginar.

## Executar

Configure as variáveis de ambiente em `.env.dev` e inicie com `npm run dev` ou
`npm start`.

No PowerShell do Windows, se a política de execução bloquear `npm.ps1`, use
`npm.cmd run dev` ou `npm.cmd start`.
