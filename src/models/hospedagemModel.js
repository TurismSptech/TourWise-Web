var database = require("../database/config");

var selectHospedagem = `
    SELECT h.id_hospedagem AS id, h.cnpj, h.tipo_hospedagem AS tipoHospedagem,
           h.nome_fantasia AS nomeFantasia, h.email_comercial AS emailComercial,
           h.uni_habit AS unidadesHabitacionais, h.leitos,
           h.uni_habit_acess AS unidadesAcessiveis, h.leito_acess AS leitosAcessiveis,
           h.dt_abertura AS dataAbertura, h.website, h.porte,
           h.validade_certificado AS validadeCertificado,
           (SELECT l.endereco FROM localizacao l
            WHERE l.fk_hospedagem = h.id_hospedagem
            ORDER BY l.id_localizacao LIMIT 1) AS endereco,
           (SELECT l.municipio FROM localizacao l
            WHERE l.fk_hospedagem = h.id_hospedagem
            ORDER BY l.id_localizacao LIMIT 1) AS municipio,
           (SELECT l.uf FROM localizacao l
            WHERE l.fk_hospedagem = h.id_hospedagem
            ORDER BY l.id_localizacao LIMIT 1) AS uf
    FROM hospedagem h
`;

function listar(filtros) {
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

    if (filtros.municipio) {
        condicoes.push(`EXISTS (SELECT 1 FROM localizacao l
                                WHERE l.fk_hospedagem = h.id_hospedagem AND l.municipio LIKE ?)`);
        valores.push("%" + filtros.municipio + "%");
    }

    var instrucaoSql = selectHospedagem +
        (condicoes.length ? " WHERE " + condicoes.join(" AND ") : "") +
        " ORDER BY h.nome_fantasia;";
    return database.executar(instrucaoSql, valores);
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
                 dt_abertura, website, porte, validade_certificado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [
            hospedagem.cnpj, hospedagem.tipoHospedagem, hospedagem.nomeFantasia,
            hospedagem.emailComercial, hospedagem.unidadesHabitacionais,
            hospedagem.leitos, hospedagem.unidadesAcessiveis,
            hospedagem.leitosAcessiveis, hospedagem.dataAbertura,
            hospedagem.website, hospedagem.porte, hospedagem.validadeCertificado
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
                dt_abertura = ?, website = ?, porte = ?, validade_certificado = ?
            WHERE id_hospedagem = ?;
        `, [
            hospedagem.cnpj, hospedagem.tipoHospedagem, hospedagem.nomeFantasia,
            hospedagem.emailComercial, hospedagem.unidadesHabitacionais,
            hospedagem.leitos, hospedagem.unidadesAcessiveis,
            hospedagem.leitosAcessiveis, hospedagem.dataAbertura,
            hospedagem.website, hospedagem.porte, hospedagem.validadeCertificado, id
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

module.exports = { listar, buscarPorId, criar, atualizar, excluir };
