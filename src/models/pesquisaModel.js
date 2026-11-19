var database = require("../database/config");

var selectPesquisa = `
    SELECT id_pesquisa AS id, nome_cliente AS nomeCliente,
           preferencia_lugar AS preferenciaLugar,
           quantidade_pessoas AS quantidadePessoas,
           precisa_acessibilidade AS precisaAcessibilidade,
           idioma, dt_viagem AS dataViagem, fk_usuario AS usuarioId
    FROM pesquisa
`;

function listar(usuarioId) {
    var instrucaoSql = selectPesquisa +
        (usuarioId ? " WHERE fk_usuario = ?" : "") +
        " ORDER BY dt_viagem DESC, id_pesquisa DESC;";
    return database.executar(instrucaoSql, usuarioId ? [usuarioId] : []);
}

function buscarPorId(id) {
    return database.executar(selectPesquisa + " WHERE id_pesquisa = ?;", [id]);
}

function criar(pesquisa) {
    var instrucaoSql = `
        INSERT INTO pesquisa
            (nome_cliente, preferencia_lugar, quantidade_pessoas,
             precisa_acessibilidade, idioma, dt_viagem, fk_usuario)
        VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    return database.executar(instrucaoSql, [
        pesquisa.nomeCliente,
        pesquisa.preferenciaLugar,
        pesquisa.quantidadePessoas,
        pesquisa.precisaAcessibilidade,
        pesquisa.idioma,
        pesquisa.dataViagem,
        pesquisa.usuarioId
    ]);
}

function atualizar(id, pesquisa) {
    var instrucaoSql = `
        UPDATE pesquisa
        SET nome_cliente = ?, preferencia_lugar = ?, quantidade_pessoas = ?,
            precisa_acessibilidade = ?, idioma = ?, dt_viagem = ?, fk_usuario = ?
        WHERE id_pesquisa = ?;
    `;
    return database.executar(instrucaoSql, [
        pesquisa.nomeCliente,
        pesquisa.preferenciaLugar,
        pesquisa.quantidadePessoas,
        pesquisa.precisaAcessibilidade,
        pesquisa.idioma,
        pesquisa.dataViagem,
        pesquisa.usuarioId,
        id
    ]);
}

function excluir(id) {
    return database.transacao(async function (executar) {
        await executar("DELETE FROM recomendacao WHERE fk_pesquisa = ?;", [id]);
        return executar("DELETE FROM pesquisa WHERE id_pesquisa = ?;", [id]);
    });
}

module.exports = { listar, buscarPorId, criar, atualizar, excluir };
