var database = require("../database/config")

function autenticar(email, senha) {
    var instrucaoSql = `
        SELECT id_usuario AS id, nome, email, fk_agencia AS agenciaId, t.tipo AS cargo
        FROM usuario u
        JOIN tipo_usuario t
        ON t.fk_usuario = u.id_usuario
        WHERE email = ? AND senha = ?;
    `;
    return database.executar(instrucaoSql, [email, senha]);
}

function listarAgencias() {
    var instrucaoSql = `
        SELECT id_agencia AS id, nome
        FROM agencia
        ORDER BY nome;
    `;
    return database.executar(instrucaoSql);
}

function cadastrar(nome, email, senha, fkAgencia) {
    return database.transacao(async function (executar) {
        var resultado = await executar(
            "INSERT INTO usuario (nome, email, senha, fk_agencia) VALUES (?, ?, ?, ?);",
            [nome, email, senha, fkAgencia]
        );
        await executar(
            "INSERT INTO tipo_usuario (tipo, fk_usuario) VALUES ('Agente', ?);",
            [resultado.insertId]
        );
        return resultado.insertId;
    });
}

function listarAgentes(agenciaId) {
    var instrucaoSql = `
        SELECT u.id_usuario AS id, u.nome, u.email,
               u.fk_agencia AS agenciaId, a.nome AS agencia,
               t.tipo AS cargo
        FROM usuario u
        JOIN tipo_usuario t ON t.fk_usuario = u.id_usuario
        JOIN agencia a ON a.id_agencia = u.fk_agencia
        WHERE t.tipo = 'Agente'
        ${agenciaId ? "AND u.fk_agencia = ?" : ""}
        ORDER BY u.nome, u.id_usuario;
    `;
    return database.executar(instrucaoSql, agenciaId ? [agenciaId] : []);
}

function buscarAgentePorId(id) {
    var instrucaoSql = `
        SELECT u.id_usuario AS id, u.nome, u.email,
               u.fk_agencia AS agenciaId, a.nome AS agencia,
               t.tipo AS cargo
        FROM usuario u
        JOIN tipo_usuario t ON t.fk_usuario = u.id_usuario
        JOIN agencia a ON a.id_agencia = u.fk_agencia
        WHERE t.tipo = 'Agente' AND u.id_usuario = ?;
    `;
    return database.executar(instrucaoSql, [id]);
}

function atualizarAgente(id, agente) {
    var instrucaoSql = `
        UPDATE usuario u
        JOIN tipo_usuario t ON t.fk_usuario = u.id_usuario AND t.tipo = 'Agente'
        SET u.nome = ?, u.email = ?, u.senha = COALESCE(?, u.senha), u.fk_agencia = ?
        WHERE u.id_usuario = ?;
    `;
    return database.executar(instrucaoSql, [
        agente.nome,
        agente.email,
        agente.senha || null,
        agente.agenciaId,
        id
    ]);
}

function excluirAgente(id) {
    return database.transacao(async function (executar) {
        var agentes = await executar(`
            SELECT u.id_usuario
            FROM usuario u
            JOIN tipo_usuario t ON t.fk_usuario = u.id_usuario
            WHERE u.id_usuario = ? AND t.tipo = 'Agente'
            FOR UPDATE;
        `, [id]);
        if (agentes.length === 0) {
            return { affectedRows: 0 };
        }

        await executar("DELETE FROM tipo_usuario WHERE fk_usuario = ? AND tipo = 'Agente';", [id]);
        return executar("DELETE FROM usuario WHERE id_usuario = ?;", [id]);
    });
}

module.exports = {
    autenticar,
    cadastrar,
    listarAgencias,
    listarAgentes,
    buscarAgentePorId,
    atualizarAgente,
    excluirAgente
};