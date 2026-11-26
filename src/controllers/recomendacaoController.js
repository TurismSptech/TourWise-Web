var recomendacaoModel = require("../models/recomendacaoModel");
var hospedagemModel = require("../models/hospedagemModel");
var comparacaoController = require("./comparacaoController");
var enviarErroBanco = require("../utils/responses").enviarErroBanco;
var pagination = require("../utils/pagination");

function idValido(valor) {
    return /^\d+$/.test(String(valor)) && Number(valor) > 0;
}

function listar(req, res) {
    var paginacao = pagination.parseQuery(req, res);
    if (!paginacao) return;
    var status = req.query.status;
    if (status && status !== "ativas" && status !== "desativadas") {
        res.status(400).json({ mensagem: "O status deve ser 'ativas' ou 'desativadas'." });
        return;
    }
    var nomeCliente = typeof req.query.nomeCliente === "string" ? req.query.nomeCliente.trim() : "";
    if (nomeCliente.length > 100) {
        res.status(400).json({ mensagem: "O nome do cliente deve ter até 100 caracteres." });
        return;
    }
    recomendacaoModel.listar(req.usuario.id, paginacao.page, paginacao.pageSize, {
        desativadas: status === "desativadas",
        favoritas: req.query.favoritas === "true",
        nomeCliente: nomeCliente
    })
        .then(function (resultado) { res.status(200).json(resultado); })
        .catch(function (erro) { enviarErroBanco(res, erro, "listar o histórico de recomendações"); });
}

async function buscar(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de pesquisa válido." });
        return;
    }
    try {
        var resultado = await recomendacaoModel.buscarPesquisa(Number(req.params.id), req.usuario.id);
        if (!resultado) {
            res.status(404).json({ mensagem: "Pesquisa não encontrada." });
            return;
        }
        var pesquisa = resultado.pesquisa;
        var cliente = {
            nomeCliente: pesquisa.nomeCliente,
            destino: pesquisa.destino,
            tipoHospedagem: pesquisa.tipoHospedagem || "",
            quantidadePessoas: Number(pesquisa.quantidadePessoas),
            precisaAcessibilidade: Number(pesquisa.precisaAcessibilidade) === 1,
            idioma: pesquisa.idioma || ""
        };
        var resultadosDashboard = await Promise.all(resultado.resultados.map(async function (item) {
            var hospedagens = await hospedagemModel.buscarPorId(item.hospedagemId);
            if (!hospedagens.length) {
                throw new Error("Uma hospedagem desta recomendação não foi encontrada.");
            }
            return {
                hospedagem: hospedagens[0],
                compatibilidade: Number(item.compatibilidade),
                criterios: comparacaoController.avaliarCriterios(hospedagens[0], cliente)
            };
        }));
        res.status(200).json(Object.assign({}, resultado, {
            dashboard: {
                id: Number(pesquisa.id),
                cliente: cliente,
                resultados: resultadosDashboard
            }
        }));
    } catch (erro) {
        enviarErroBanco(res, erro, "buscar a recomendação");
    }
}

async function atualizar(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de pesquisa válido." });
        return;
    }
    try {
        var analise = await comparacaoController.calcular(req.body);
        var atualizado = await recomendacaoModel.atualizar(
            Number(req.params.id),
            req.usuario.id,
            analise.cliente,
            analise.resultados
        );
        if (!atualizado) {
            res.status(404).json({ mensagem: "Pesquisa não encontrada." });
            return;
        }
        res.status(200).json({
            id: Number(req.params.id),
            cliente: analise.cliente,
            resultados: analise.resultados
        });
    } catch (erro) {
        if (erro.statusCode) {
            res.status(erro.statusCode).json({ mensagem: erro.message });
            return;
        }
        enviarErroBanco(res, erro, "atualizar a pesquisa e suas recomendações");
    }
}

function alterarStatus(req, res) {
    if (!idValido(req.params.id) || typeof req.body.ativo !== "boolean") {
        res.status(400).json({ mensagem: "Informe uma pesquisa e um estado ativo válido." });
        return;
    }
    recomendacaoModel.alterarStatus(Number(req.params.id), req.usuario.id, req.body.ativo)
        .then(function (resultado) {
            if (!resultado.affectedRows) {
                res.status(404).json({ mensagem: "Pesquisa não encontrada." });
                return;
            }
            res.status(204).end();
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "alterar o estado da recomendação"); });
}

function alterarFavorito(req, res) {
    if (!idValido(req.params.recomendacaoId) || typeof req.body.favorito !== "boolean") {
        res.status(400).json({ mensagem: "Informe uma recomendação e um estado de favorito válido." });
        return;
    }
    recomendacaoModel.alterarFavorito(
        Number(req.params.recomendacaoId),
        req.usuario.id,
        req.body.favorito
    )
        .then(function (resultado) {
            if (!resultado.affectedRows) {
                res.status(404).json({ mensagem: "Recomendação não encontrada." });
                return;
            }
            res.status(204).end();
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "favoritar a recomendação"); });
}

module.exports = { listar, buscar, atualizar, alterarStatus, alterarFavorito };
