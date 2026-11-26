var database = require("../database/config");
var pagination = require("../utils/pagination");

var selectHospedagem = `
    SELECT h.id_hospedagem AS id, h.cnpj, h.tipo_hospedagem AS tipoHospedagem,
           h.nome_fantasia AS nomeFantasia, h.email_comercial AS emailComercial,
           h.uni_habit AS unidadesHabitacionais, h.leitos,
           h.uni_habit_acess AS unidadesAcessiveis, h.leito_acess AS leitosAcessiveis,
           h.dt_abertura AS dataAbertura, h.website, h.porte,
           (SELECT l.endereco FROM localizacao l
            WHERE l.fk_hospedagem = h.id_hospedagem
            ORDER BY l.id_localizacao LIMIT 1) AS endereco,
           (SELECT l.municipio FROM localizacao l
            WHERE l.fk_hospedagem = h.id_hospedagem
            ORDER BY l.id_localizacao LIMIT 1) AS municipio,
           (SELECT l.uf FROM localizacao l
            WHERE l.fk_hospedagem = h.id_hospedagem
            ORDER BY l.id_localizacao LIMIT 1) AS uf,
           (SELECT GROUP_CONCAT(i.idioma SEPARATOR ',')
            FROM idiomas_hospedagem ih
            JOIN idioma i ON i.id_idioma = ih.fk_idioma
            WHERE ih.fk_hospedagem = h.id_hospedagem) AS idiomas,
           (SELECT t.numero FROM telefone t
            WHERE t.fk_hospedagem = h.id_hospedagem
            ORDER BY t.id_telefone LIMIT 1) AS telefone,
           (SELECT CONCAT_WS(' - ', c.codigo, c.descricao)
            FROM cnaes_hospedagem ch
            JOIN cnae c ON c.id_cnae = ch.fk_cnae
            WHERE ch.fk_hospedagem = h.id_hospedagem
            ORDER BY ch.fk_cnae LIMIT 1) AS cnaePrincipal
    FROM hospedagem h
`;

function construirFiltros(filtros) {
    var condicoes = [];
    var valores = [];

    if (filtros.busca) {
        condicoes.push(`(
            h.nome_fantasia LIKE ? OR h.tipo_hospedagem LIKE ? OR
            EXISTS (SELECT 1 FROM localizacao l
                    WHERE l.fk_hospedagem = h.id_hospedagem AND l.municipio LIKE ?)
        )`);
        var busca = "%" + filtros.busca + "%";
        valores.push(busca, busca, busca);
    }

    if (filtros.tipoHospedagem) {
        condicoes.push("h.tipo_hospedagem = ?");
        valores.push(filtros.tipoHospedagem);
    }

    if (filtros.municipio) {
        condicoes.push(`EXISTS (SELECT 1 FROM localizacao l
                                WHERE l.fk_hospedagem = h.id_hospedagem AND l.municipio LIKE ?)`);
        valores.push("%" + filtros.municipio + "%");
    }

    return {
        clausula: condicoes.length ? " WHERE " + condicoes.join(" AND ") : "",
        valores: valores
    };
}

function listarPaginado(filtros, page, pageSize) {
    var filtro = construirFiltros(filtros);
    var countSql = "SELECT COUNT(*) AS total FROM hospedagem h" + filtro.clausula + ";";

    return database.executar(countSql, filtro.valores).then(function (countRows) {
        var total = Number(countRows[0].total);
        var metadados = pagination.response([], page, pageSize, total);
        var offset = (metadados.pagination.page - 1) * pageSize;
        var queryValues = filtro.valores.concat([pageSize, offset]);
        var querySql = selectHospedagem + filtro.clausula +
            " ORDER BY h.nome_fantasia, h.id_hospedagem LIMIT ? OFFSET ?;";

        return database.executar(querySql, queryValues).then(function (items) {
            return pagination.response(
                items,
                metadados.pagination.page,
                pageSize,
                total
            );
        });
    });
}

function listarTipos() {
    return database.executar(`
        SELECT DISTINCT tipo_hospedagem AS tipoHospedagem
        FROM hospedagem
        WHERE tipo_hospedagem IS NOT NULL AND TRIM(tipo_hospedagem) <> ''
        ORDER BY tipo_hospedagem;
    `);
}

function listarLotePorId(ultimoId, limite) {
    return database.executar(
        selectHospedagem +
        " WHERE h.id_hospedagem > ? ORDER BY h.id_hospedagem LIMIT ?;",
        [ultimoId, limite]
    );
}

function contar() {
    return database.executar("SELECT COUNT(*) AS total FROM hospedagem;");
}

function buscarPorId(id) {
    return database.executar(selectHospedagem + " WHERE h.id_hospedagem = ?;", [id]);
}

function criar(hospedagem) {
    return database.transacao(async function (executar) {
        var resultado = await executar(`
            INSERT INTO hospedagem
                (cnpj, tipo_hospedagem, nome_fantasia, email_comercial,
                 uni_habit, leitos, uni_habit_acess, leito_acess,
                 dt_abertura, website, porte)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [
            hospedagem.cnpj, hospedagem.tipoHospedagem, hospedagem.nomeFantasia,
            hospedagem.emailComercial, hospedagem.unidadesHabitacionais,
            hospedagem.leitos, hospedagem.unidadesAcessiveis,
            hospedagem.leitosAcessiveis, hospedagem.dataAbertura,
            hospedagem.website, hospedagem.porte
        ]);

        await executar(
            "INSERT INTO localizacao (endereco, municipio, uf, fk_hospedagem) VALUES (?, ?, ?, ?);",
            [hospedagem.endereco, hospedagem.municipio, hospedagem.uf, resultado.insertId]
        );
        return resultado.insertId;
    });
}

function atualizar(id, hospedagem) {
    return database.transacao(async function (executar) {
        await executar(`
            UPDATE hospedagem
            SET cnpj = ?, tipo_hospedagem = ?, nome_fantasia = ?, email_comercial = ?,
                uni_habit = ?, leitos = ?, uni_habit_acess = ?, leito_acess = ?,
                dt_abertura = ?, website = ?, porte = ?
            WHERE id_hospedagem = ?;
        `, [
            hospedagem.cnpj, hospedagem.tipoHospedagem, hospedagem.nomeFantasia,
            hospedagem.emailComercial, hospedagem.unidadesHabitacionais,
            hospedagem.leitos, hospedagem.unidadesAcessiveis,
            hospedagem.leitosAcessiveis, hospedagem.dataAbertura,
            hospedagem.website, hospedagem.porte, id
        ]);

        var localizacoes = await executar(
            "SELECT id_localizacao FROM localizacao WHERE fk_hospedagem = ? ORDER BY id_localizacao LIMIT 1;",
            [id]
        );
        if (localizacoes.length) {
            await executar(
                "UPDATE localizacao SET endereco = ?, municipio = ?, uf = ? WHERE id_localizacao = ?;",
                [hospedagem.endereco, hospedagem.municipio, hospedagem.uf, localizacoes[0].id_localizacao]
            );
        } else {
            await executar(
                "INSERT INTO localizacao (endereco, municipio, uf, fk_hospedagem) VALUES (?, ?, ?, ?);",
                [hospedagem.endereco, hospedagem.municipio, hospedagem.uf, id]
            );
        }
    });
}

function excluir(id) {
    return database.transacao(async function (executar) {
        await executar("DELETE FROM recomendacao WHERE fk_hospedagem = ?;", [id]);
        await executar("DELETE FROM cnaes_hospedagem WHERE fk_hospedagem = ?;", [id]);
        await executar("DELETE FROM idiomas_hospedagem WHERE fk_hospedagem = ?;", [id]);
        await executar("DELETE FROM telefone WHERE fk_hospedagem = ?;", [id]);
        await executar("DELETE FROM localizacao WHERE fk_hospedagem = ?;", [id]);
        return executar("DELETE FROM hospedagem WHERE id_hospedagem = ?;", [id]);
    });
}

module.exports = {
    listarPaginado,
    listarTipos,
    listarLotePorId,
    contar,
    buscarPorId,
    criar,
    atualizar,
    excluir
};
