# TourWise - API

API Node.js/Express com persistência MySQL para agentes, hospedagens e pesquisas de clientes.

## Configuração do banco

Crie o banco e as tabelas executando `src/database/script-tabelas.sql`. Para bancos
criados antes da adição do nome do agente, execute esta migração uma única vez:

```sql
ALTER TABLE usuario ADD COLUMN nome VARCHAR(45) NULL;
UPDATE usuario
SET nome = COALESCE(
    NULLIF(LEFT(SUBSTRING_INDEX(email, '@', 1), 45), ''),
    CONCAT('Agente ', id_usuario)
);
ALTER TABLE usuario MODIFY nome VARCHAR(45) NOT NULL;
```

Configure as variáveis de ambiente do projeto e inicie com `npm run dev` (desenvolvimento)
ou `npm start`.

## CRUDs

Os endpoints recebem e retornam JSON. As consultas aceitam parâmetros preparados.

### Agentes (`/usuarios`)

| Método | Endpoint | Ação |
|---|---|---|
| GET | `/usuarios?agenciaId=1` | Lista agentes, opcionalmente filtrando por agência |
| GET | `/usuarios/:id` | Busca um agente |
| POST | `/usuarios` | Cadastra agente e seu vínculo de função |
| PUT | `/usuarios/:id` | Atualiza nome, email, agência e, opcionalmente, senha |
| DELETE | `/usuarios/:id` | Exclui agente |

O cadastro aceita `nome`, `email`, `senha` e `agenciaId`. A rota legada
`POST /usuarios/cadastrar` continua aceitando `emailServer`, `senhaServer` e
`idAgenciaServer`.
Na atualização use `nome`, `email`, `fk_agencia` e, se necessário, `senha`.
O endpoint `POST /usuarios/autenticar` e `GET /usuarios/agencias` continuam disponíveis.

### Hospedagens (`/hospedagens`)

| Método | Endpoint | Ação |
|---|---|---|
| GET | `/hospedagens?busca=hotel&municipio=Recife` | Lista e filtra hospedagens |
| GET | `/hospedagens/:id` | Busca uma hospedagem com localização |
| POST | `/hospedagens` | Cadastra hospedagem e localização |
| PUT | `/hospedagens/:id` | Atualiza hospedagem e localização |
| DELETE | `/hospedagens/:id` | Exclui hospedagem e registros dependentes |

Nome, tipo de hospedagem, município e UF são obrigatórios. Os demais campos seguem
as colunas da tabela `hospedagem` e podem ser enviados em snake_case ou camelCase.
Por exemplo: `nome_fantasia`, `tipo_hospedagem`, `municipio`, `uf`, `cnpj`,
`email_comercial`, `uni_habit`, `leitos`, `uni_habit_acess`, `leito_acess`,
`dt_abertura`, `website`, `porte`, `validade_certificado` e `endereco`.

### Pesquisas de clientes (`/pesquisas`)

| Método | Endpoint | Ação |
|---|---|---|
| GET | `/pesquisas?usuarioId=1` | Lista pesquisas, opcionalmente por agente |
| GET | `/pesquisas/:id` | Busca uma pesquisa |
| POST | `/pesquisas` | Cadastra pesquisa de cliente |
| PUT | `/pesquisas/:id` | Atualiza pesquisa |
| DELETE | `/pesquisas/:id` | Exclui pesquisa e recomendações relacionadas |

O corpo recebe `nome_cliente`, `preferencia_lugar`, `quantidade_pessoas`,
`precisa_acessibilidade` (booleano ou 0/1), `idioma`, `dt_viagem` (AAAA-MM-DD)
e `fk_usuario`.