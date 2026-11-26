var database = require("../database/config");
var pagination = require("../utils/pagination");

function listarPaginado(page, pageSize) {
    return database.executar("SELECT COUNT(*) AS total FROM empresa;").then(function (countRows) {
        var total = Number(countRows[0].total);
        var metadata = pagination.response([], page, pageSize, total);
        var offset = (metadata.pagination.page - 1) * pageSize;
        return database.executar(`
            SELECT e.id_empresa AS id, e.nome, e.email,
                   COUNT(DISTINCT CASE WHEN LOWER(TRIM(t.tipo_usuario)) = 'agente'
                                       THEN u.cod_usuario END) AS totalAgentes
            FROM empresa e
            LEFT JOIN usuario u ON u.fk_empresa = e.id_empresa
            LEFT JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
            GROUP BY e.id_empresa, e.nome, e.email
            ORDER BY e.nome, e.id_empresa
            LIMIT ? OFFSET ?;
        `, [pageSize, offset]).then(function (items) {
            return pagination.response(items, metadata.pagination.page, pageSize, total);
        });
    });
}

function contar() {
    return database.executar("SELECT COUNT(*) AS total FROM empresa;");
}

function buscarPorId(id) {
    return database.executar(`
        SELECT id_empresa AS id, nome, email
        FROM empresa
        WHERE id_empresa = ?;
    `, [id]);
}

function criar(agencia) {
    return database.executar(
        "INSERT INTO empresa (nome, email) VALUES (?, ?);",
        [agencia.nome, agencia.email || null]
    ).then(function (resultado) {
        return resultado.insertId;
    });
}

function atualizar(id, agencia) {
    return database.executar(
        "UPDATE empresa SET nome = ?, email = ? WHERE id_empresa = ?;",
        [agencia.nome, agencia.email || null, id]
    );
}

function excluir(id) {
    return database.transacao(async function (query) {
        var empresas = await query(
            "SELECT id_empresa FROM empresa WHERE id_empresa = ? FOR UPDATE;",
            [id]
        );
        if (empresas.length === 0) return { affectedRows: 0 };

        await query("DELETE FROM notificacoes WHERE fk_empresa = ?;", [id]);
        var usuarios = await query("SELECT cod_usuario FROM usuario WHERE fk_empresa = ?;", [id]);
        for (var i = 0; i < usuarios.length; i++) {
            await query(`
                DELETE r FROM recomendacao r
                JOIN pesquisa p ON p.id_pesquisa = r.fk_pesquisa
                WHERE p.fk_usuario = ?;
            `, [usuarios[i].cod_usuario]);
            await query("DELETE FROM pesquisa WHERE fk_usuario = ?;", [usuarios[i].cod_usuario]);
        }
        await query("DELETE FROM usuario WHERE fk_empresa = ?;", [id]);
        return query("DELETE FROM empresa WHERE id_empresa = ?;", [id]);
    });
}

module.exports = { listarPaginado, contar, buscarPorId, criar, atualizar, excluir };
