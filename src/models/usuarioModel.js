var database = require("../database/config");
var pagination = require("../utils/pagination");

function autenticar(email, senha) {
    return database.executar(`
        SELECT u.cod_usuario AS id, u.nome, u.email,
               u.fk_empresa AS agenciaId, e.nome AS agencia,
               LOWER(TRIM(t.tipo_usuario)) AS cargo
        FROM usuario u
        JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
        LEFT JOIN empresa e ON e.id_empresa = u.fk_empresa
        WHERE u.email = ? AND u.senha = ?
          AND LOWER(TRIM(t.tipo_usuario)) IN ('agente', 'gestor', 'adm', 'administrador');
    `, [email, senha]);
}

function listarAgentesPaginado(empresaId, page, pageSize) {
    return database.executar(`
        SELECT COUNT(*) AS total
        FROM usuario u
        JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
        WHERE LOWER(TRIM(t.tipo_usuario)) = 'agente'
          AND u.fk_empresa = ?;
    `, [empresaId]).then(function (countRows) {
        var total = Number(countRows[0].total);
        var metadata = pagination.response([], page, pageSize, total);
        var offset = (metadata.pagination.page - 1) * pageSize;
        return database.executar(`
            SELECT u.cod_usuario AS id, u.nome, u.email,
                   u.fk_empresa AS agenciaId, e.nome AS agencia,
                   t.tipo_usuario AS cargo
            FROM usuario u
            JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
            JOIN empresa e ON e.id_empresa = u.fk_empresa
            WHERE LOWER(TRIM(t.tipo_usuario)) = 'agente'
              AND u.fk_empresa = ?
            ORDER BY u.nome, u.cod_usuario
            LIMIT ? OFFSET ?;
        `, [empresaId, pageSize, offset]).then(function (items) {
            return pagination.response(items, metadata.pagination.page, pageSize, total);
        });
    });
}

function roleId(query, role) {
    return query(
        "SELECT id_tipo_usuario FROM tipo_usuario WHERE LOWER(TRIM(tipo_usuario)) = ? LIMIT 1;",
        [role]
    ).then(function (rows) {
        if (!rows.length) {
            var error = new Error("O tipo de usuário '" + role + "' não está cadastrado.");
            error.code = "USER_TYPE_NOT_FOUND";
            throw error;
        }
        return rows[0].id_tipo_usuario;
    });
}

function cadastrarAgente(nome, email, senha, empresaId) {
    return database.transacao(async function (query) {
        var tipoId = await roleId(query, "agente");
        var resultado = await query(
            "INSERT INTO usuario (nome, email, senha, fk_empresa, fk_tipo_usuario) VALUES (?, ?, ?, ?, ?);",
            [nome, email, senha, empresaId, tipoId]
        );
        return resultado.insertId;
    });
}

function contarPorPerfil() {
    return database.executar(`
        SELECT LOWER(TRIM(t.tipo_usuario)) AS cargo, COUNT(u.cod_usuario) AS total
        FROM usuario u
        JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
        GROUP BY LOWER(TRIM(t.tipo_usuario));
    `);
}

function listarAdministradoresPaginado(page, pageSize) {
    return database.executar(`
        SELECT COUNT(*) AS total
        FROM usuario u
        JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
        WHERE LOWER(TRIM(t.tipo_usuario)) IN ('adm', 'administrador');
    `).then(function (countRows) {
        var total = Number(countRows[0].total);
        var metadata = pagination.response([], page, pageSize, total);
        var offset = (metadata.pagination.page - 1) * pageSize;
        return database.executar(`
            SELECT u.cod_usuario AS id, u.nome, u.email,
                   LOWER(TRIM(t.tipo_usuario)) AS cargo
            FROM usuario u
            JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
            WHERE LOWER(TRIM(t.tipo_usuario)) IN ('adm', 'administrador')
            ORDER BY u.nome, u.cod_usuario
            LIMIT ? OFFSET ?;
        `, [pageSize, offset]).then(function (items) {
            return pagination.response(items, metadata.pagination.page, pageSize, total);
        });
    });
}

function buscarAdministradorPorId(id) {
    return database.executar(`
        SELECT u.cod_usuario AS id, u.nome, u.email,
               LOWER(TRIM(t.tipo_usuario)) AS cargo
        FROM usuario u
        JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
        WHERE u.cod_usuario = ?
          AND LOWER(TRIM(t.tipo_usuario)) IN ('adm', 'administrador');
    `, [id]);
}

function cadastrarAdministrador(nome, email, senha) {
    return database.transacao(async function (query) {
        var tipoId = await roleId(query, "adm");
        var resultado = await query(
            "INSERT INTO usuario (nome, email, senha, fk_empresa, fk_tipo_usuario) VALUES (?, ?, ?, NULL, ?);",
            [nome, email, senha, tipoId]
        );
        return resultado.insertId;
    });
}

function atualizarAdministrador(id, administrador) {
    return database.executar(`
        UPDATE usuario u
        JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
        SET u.nome = ?, u.email = ?, u.senha = COALESCE(?, u.senha)
        WHERE u.cod_usuario = ?
          AND LOWER(TRIM(t.tipo_usuario)) IN ('adm', 'administrador');
    `, [administrador.nome, administrador.email, administrador.senha || null, id]);
}

function excluirAdministrador(id) {
    return database.transacao(async function (query) {
        var admins = await query(`
            SELECT u.cod_usuario
            FROM usuario u
            JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
            WHERE u.cod_usuario = ?
              AND LOWER(TRIM(t.tipo_usuario)) IN ('adm', 'administrador')
            FOR UPDATE;
        `, [id]);
        if (admins.length === 0) return { affectedRows: 0 };
        await query(`
            DELETE r FROM recomendacao r
            JOIN pesquisa p ON p.id_pesquisa = r.fk_pesquisa
            WHERE p.fk_usuario = ?;
        `, [id]);
        await query("DELETE FROM pesquisa WHERE fk_usuario = ?;", [id]);
        return query("DELETE FROM usuario WHERE cod_usuario = ?;", [id]);
    });
}

function buscarAgentePorId(id) {
    return database.executar(`
        SELECT u.cod_usuario AS id, u.nome, u.email,
               u.fk_empresa AS agenciaId, e.nome AS agencia,
               t.tipo_usuario AS cargo
        FROM usuario u
        JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
        JOIN empresa e ON e.id_empresa = u.fk_empresa
        WHERE LOWER(TRIM(t.tipo_usuario)) = 'agente' AND u.cod_usuario = ?;
    `, [id]);
}

function atualizarAgente(id, agente) {
    return database.executar(`
        UPDATE usuario u
        JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
        SET u.nome = ?, u.email = ?, u.senha = COALESCE(?, u.senha)
        WHERE u.cod_usuario = ?
          AND u.fk_empresa = ?
          AND LOWER(TRIM(t.tipo_usuario)) = 'agente';
    `, [agente.nome, agente.email, agente.senha || null, id, agente.agenciaId]);
}

function excluirAgente(id, empresaId) {
    return database.transacao(async function (query) {
        var agentes = await query(`
            SELECT u.cod_usuario
            FROM usuario u
            JOIN tipo_usuario t ON t.id_tipo_usuario = u.fk_tipo_usuario
            WHERE u.cod_usuario = ? AND u.fk_empresa = ?
              AND LOWER(TRIM(t.tipo_usuario)) = 'agente'
            FOR UPDATE;
        `, [id, empresaId]);
        if (agentes.length === 0) return { affectedRows: 0 };

        await query(`
            DELETE r FROM recomendacao r
            JOIN pesquisa p ON p.id_pesquisa = r.fk_pesquisa
            WHERE p.fk_usuario = ?;
        `, [id]);
        await query("DELETE FROM pesquisa WHERE fk_usuario = ?;", [id]);
        return query("DELETE FROM usuario WHERE cod_usuario = ?;", [id]);
    });
}

module.exports = {
    autenticar,
    listarAgentesPaginado,
    cadastrarAgente,
    buscarAgentePorId,
    atualizarAgente,
    excluirAgente,
    contarPorPerfil,
    listarAdministradoresPaginado,
    buscarAdministradorPorId,
    cadastrarAdministrador,
    atualizarAdministrador,
    excluirAdministrador
};
