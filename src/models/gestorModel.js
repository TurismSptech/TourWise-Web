var database = require("../database/config");
var pagination = require("../utils/pagination");

function listarPaginado(page, pageSize) {
    return database.executar(`
        SELECT COUNT(*) AS total
        FROM usuario u
        JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
        WHERE LOWER(TRIM(t.tipo_usuario)) = 'gestor';
    `).then(function (countRows) {
        var total = Number(countRows[0].total);
        var metadata = pagination.response([], page, pageSize, total);
        var offset = (metadata.pagination.page - 1) * pageSize;
        return database.executar(`
            SELECT u.cod_usuario AS id, u.nome, u.email,
                   u.fk_empresa AS empresaId, e.nome AS empresa
            FROM usuario u
            JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
            JOIN empresa e ON e.id_empresa = u.fk_empresa
            WHERE LOWER(TRIM(t.tipo_usuario)) = 'gestor'
            ORDER BY u.nome, u.cod_usuario
            LIMIT ? OFFSET ?;
        `, [pageSize, offset]).then(function (items) {
            return pagination.response(items, metadata.pagination.page, pageSize, total);
        });
    });
}

function listarEmpresas() {
    return database.executar(
        "SELECT id_empresa AS id, nome FROM empresa ORDER BY nome, id_empresa;"
    );
}

function buscarPorId(id) {
    return database.executar(`
        SELECT u.cod_usuario AS id, u.nome, u.email,
               u.fk_empresa AS empresaId, e.nome AS empresa
        FROM usuario u
        JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
        JOIN empresa e ON e.id_empresa = u.fk_empresa
        WHERE u.cod_usuario = ? AND LOWER(TRIM(t.tipo_usuario)) = 'gestor';
    `, [id]);
}

function salvar(id, gestor) {
    return database.transacao(async function (query) {
        var empresas = await query("SELECT id_empresa FROM empresa WHERE id_empresa = ?;", [gestor.empresaId]);
        if (!empresas.length) {
            var erroEmpresa = new Error("A empresa selecionada não foi encontrada.");
            erroEmpresa.code = "COMPANY_NOT_FOUND";
            throw erroEmpresa;
        }

        var tipo = await query(
            "SELECT id_tipo_usuario FROM tipo_usuario WHERE LOWER(TRIM(tipo_usuario)) = 'gestor' LIMIT 1;"
        );
        if (!tipo.length) {
            var erroTipo = new Error("O tipo de usuário Gestor não está cadastrado.");
            erroTipo.code = "USER_TYPE_NOT_FOUND";
            throw erroTipo;
        }

        if (id) {
            var existente = await query(`
                SELECT u.cod_usuario
                FROM usuario u
                JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
                WHERE u.cod_usuario = ? AND LOWER(TRIM(t.tipo_usuario)) = 'gestor'
                FOR UPDATE;
            `, [id]);
            if (!existente.length) return null;
            await query(`
                UPDATE usuario
                SET nome = ?, email = ?, senha = COALESCE(?, senha), fk_empresa = ?
                WHERE cod_usuario = ?;
            `, [gestor.nome, gestor.email, gestor.senha || null, gestor.empresaId, id]);
            return id;
        }

        var resultado = await query(`
            INSERT INTO usuario (nome, email, senha, fk_empresa, fk_tipo_usuario)
            VALUES (?, ?, ?, ?, ?);
        `, [gestor.nome, gestor.email, gestor.senha, gestor.empresaId, tipo[0].id_tipo_usuario]);
        return resultado.insertId;
    });
}

function excluir(id) {
    return database.executar(`
        DELETE u FROM usuario u
        JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
        WHERE u.cod_usuario = ? AND LOWER(TRIM(t.tipo_usuario)) = 'gestor';
    `, [id]);
}

module.exports = { listarPaginado, listarEmpresas, buscarPorId, salvar, excluir };
