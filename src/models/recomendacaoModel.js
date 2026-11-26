var database = require("../database/config");
var pagination = require("../utils/pagination");

var recomendacaoSelect = `
    SELECT r.id_recomendacao AS recomendacaoId, r.fk_pesquisa AS pesquisaId,
           r.indice_compatibilidade AS compatibilidade, r.posicao_rank AS posicao,
           r.favorito, p.nome_cliente AS nomeCliente, p.preferencia_lugar AS destino,
           p.tipo_hospedagem_preferida AS tipoHospedagem,
           p.quantidade_pessoas AS quantidadePessoas,
           p.precisa_acessibilidade AS precisaAcessibilidade, p.idioma,
           p.data_criacao AS dataCriacao, h.id_hospedagem AS hospedagemId,
           h.nome_fantasia AS hospedagem, h.tipo_hospedagem AS hospedagemTipo,
           (SELECT l.municipio FROM localizacao l
            WHERE l.fk_hospedagem = h.id_hospedagem ORDER BY l.id_localizacao LIMIT 1) AS municipio,
           (SELECT l.uf FROM localizacao l
            WHERE l.fk_hospedagem = h.id_hospedagem ORDER BY l.id_localizacao LIMIT 1) AS uf
    FROM recomendacao r
    JOIN pesquisa p ON p.id_pesquisa = r.fk_pesquisa
    JOIN hospedagem h ON h.id_hospedagem = r.fk_hospedagem
    JOIN usuario u ON u.cod_usuario = p.fk_usuario
`;

function listar(usuarioId, page, pageSize, filtros) {
    var conditions = ["p.fk_usuario = ?"];
    var values = [usuarioId];
    if (filtros.desativadas) {
        conditions.push("p.ativo = 0");
    } else {
        conditions.push("p.ativo = 1");
    }
    if (filtros.favoritas) conditions.push("r.favorito = 1");
    if (filtros.nomeCliente) {
        conditions.push("p.nome_cliente LIKE ?");
        values.push("%" + filtros.nomeCliente + "%");
    }
    var where = " WHERE " + conditions.join(" AND ");
    return database.executar(
        "SELECT COUNT(*) AS total FROM recomendacao r JOIN pesquisa p ON p.id_pesquisa = r.fk_pesquisa" +
        where + ";",
        values
    ).then(function (countRows) {
        var total = Number(countRows[0].total);
        var metadata = pagination.response([], page, pageSize, total);
        var offset = (metadata.pagination.page - 1) * pageSize;
        return database.executar(
            recomendacaoSelect + where +
            " ORDER BY p.data_criacao DESC, p.id_pesquisa DESC, r.posicao_rank LIMIT ? OFFSET ?;",
            values.concat([pageSize, offset])
        ).then(function (items) {
            return pagination.response(items, metadata.pagination.page, pageSize, total);
        });
    });
}

function buscarPesquisa(id, usuarioId) {
    return database.executar(`
        SELECT id_pesquisa AS id, nome_cliente AS nomeCliente,
               preferencia_lugar AS destino,
               tipo_hospedagem_preferida AS tipoHospedagem,
               quantidade_pessoas AS quantidadePessoas,
               precisa_acessibilidade AS precisaAcessibilidade, idioma,
               ativo, data_criacao AS dataCriacao
        FROM pesquisa
        WHERE id_pesquisa = ? AND fk_usuario = ?;
    `, [id, usuarioId]).then(function (pesquisas) {
        if (!pesquisas.length) return null;
        return database.executar(
            recomendacaoSelect +
            " WHERE p.id_pesquisa = ? AND p.fk_usuario = ? ORDER BY r.posicao_rank;",
            [id, usuarioId]
        ).then(function (resultados) {
            return { pesquisa: pesquisas[0], resultados: resultados };
        });
    });
}

function salvar(usuarioId, pesquisa, resultados) {
    return database.transacao(async function (query) {
        var created = await query(`
            INSERT INTO pesquisa
                (nome_cliente, preferencia_lugar, tipo_hospedagem_preferida,
                 quantidade_pessoas, precisa_acessibilidade, idioma, fk_usuario)
            VALUES (?, ?, ?, ?, ?, ?, ?);
        `, [
            pesquisa.nomeCliente || null,
            pesquisa.destino,
            pesquisa.tipoHospedagem || null,
            pesquisa.quantidadePessoas,
            pesquisa.precisaAcessibilidade ? 1 : 0,
            pesquisa.idioma || null,
            usuarioId
        ]);
        for (var i = 0; i < resultados.length; i++) {
            await query(`
                INSERT INTO recomendacao
                    (fk_hospedagem, fk_pesquisa, indice_compatibilidade, posicao_rank)
                VALUES (?, ?, ?, ?);
            `, [
                resultados[i].hospedagem.id,
                created.insertId,
                String(resultados[i].compatibilidade),
                i + 1
            ]);
        }
        return created.insertId;
    });
}

function atualizar(id, usuarioId, pesquisa, resultados) {
    return database.transacao(async function (query) {
        var existentes = await query(
            "SELECT id_pesquisa FROM pesquisa WHERE id_pesquisa = ? AND fk_usuario = ? FOR UPDATE;",
            [id, usuarioId]
        );
        if (!existentes.length) return false;
        var favoritos = await query(
            "SELECT fk_hospedagem FROM recomendacao WHERE fk_pesquisa = ? AND favorito = 1;",
            [id]
        );
        var favoritasIds = favoritos.map(function (item) { return Number(item.fk_hospedagem); });
        await query(`
            UPDATE pesquisa
            SET nome_cliente = ?, preferencia_lugar = ?, tipo_hospedagem_preferida = ?,
                quantidade_pessoas = ?, precisa_acessibilidade = ?, idioma = ?
            WHERE id_pesquisa = ? AND fk_usuario = ?;
        `, [
            pesquisa.nomeCliente || null,
            pesquisa.destino,
            pesquisa.tipoHospedagem || null,
            pesquisa.quantidadePessoas,
            pesquisa.precisaAcessibilidade ? 1 : 0,
            pesquisa.idioma || null,
            id,
            usuarioId
        ]);
        await query("DELETE FROM recomendacao WHERE fk_pesquisa = ?;", [id]);
        for (var i = 0; i < resultados.length; i++) {
            await query(`
                INSERT INTO recomendacao
                    (fk_hospedagem, fk_pesquisa, indice_compatibilidade, posicao_rank, favorito)
                VALUES (?, ?, ?, ?, ?);
            `, [
                resultados[i].hospedagem.id,
                id,
                String(resultados[i].compatibilidade),
                i + 1,
                favoritasIds.indexOf(Number(resultados[i].hospedagem.id)) >= 0 ? 1 : 0
            ]);
        }
        return true;
    });
}

function alterarStatus(id, usuarioId, ativo) {
    return database.transacao(async function (query) {
        var pesquisas = await query(
            "SELECT id_pesquisa FROM pesquisa WHERE id_pesquisa = ? AND fk_usuario = ? FOR UPDATE;",
            [id, usuarioId]
        );
        if (!pesquisas.length) return { affectedRows: 0 };
        await query("UPDATE pesquisa SET ativo = ? WHERE id_pesquisa = ?;", [ativo ? 1 : 0, id]);
        return { affectedRows: 1 };
    });
}

function alterarFavorito(id, usuarioId, favorito) {
    return database.transacao(async function (query) {
        var recomendacoes = await query(`
            SELECT r.id_recomendacao
            FROM recomendacao r
            JOIN pesquisa p ON p.id_pesquisa = r.fk_pesquisa
            WHERE r.id_recomendacao = ? AND p.fk_usuario = ?
            FOR UPDATE;
        `, [id, usuarioId]);
        if (!recomendacoes.length) return { affectedRows: 0 };
        await query("UPDATE recomendacao SET favorito = ? WHERE id_recomendacao = ?;", [
            favorito ? 1 : 0,
            id
        ]);
        return { affectedRows: 1 };
    });
}

module.exports = { listar, buscarPesquisa, salvar, atualizar, alterarStatus, alterarFavorito };
