var agenciaModel = require("../models/agenciaModel");
var enviarErroBanco = require("../utils/responses").enviarErroBanco;
var pagination = require("../utils/pagination");

function idValido(valor) {
    return /^\d+$/.test(String(valor)) && Number(valor) > 0;
}

function validar(body) {
    body = body || {};
    var nome = typeof body.nome === "string" ? body.nome.trim() : "";
    var email = typeof body.email === "string" ? body.email.trim() : "";

    if (!nome || nome.length > 45) {
        return { erro: "Informe o nome da empresa com até 45 caracteres." };
    }
    if (email && (email.length > 45 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return { erro: "Informe um email válido com até 45 caracteres." };
    }
    return {
        valor: {
            nome: nome,
            email: email || null
        }
    };
}

function listar(req, res) {
    var paginacao = pagination.parseQuery(req, res);
    if (!paginacao) return;

    agenciaModel.listarPaginado(paginacao.page, paginacao.pageSize)
        .then(function (resultado) { res.status(200).json(resultado); })
        .catch(function (erro) { enviarErroBanco(res, erro, "listar as empresas"); });
}

function buscarPorId(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de empresa válido." });
        return;
    }
    agenciaModel.buscarPorId(Number(req.params.id))
        .then(function (resultado) {
            if (!resultado.length) {
                res.status(404).json({ mensagem: "Empresa não encontrada." });
                return;
            }
            res.status(200).json(resultado[0]);
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "buscar a empresa"); });
}

function criar(req, res) {
    var validacao = validar(req.body);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }
    agenciaModel.criar(validacao.valor)
        .then(function (resultado) {
            res.status(201).json({
                id: resultado,
                nome: validacao.valor.nome,
                email: validacao.valor.email
            });
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "cadastrar a agência"); });
}

function atualizar(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de empresa válido." });
        return;
    }
    var validacao = validar(req.body);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }
    var id = Number(req.params.id);
    agenciaModel.atualizar(id, validacao.valor)
        .then(function () { return agenciaModel.buscarPorId(id); })
        .then(function (resultado) {
            if (!resultado.length) {
                res.status(404).json({ mensagem: "Empresa não encontrada." });
                return;
            }
            res.status(200).json(resultado[0]);
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "atualizar a empresa"); });
}

function excluir(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de empresa válido." });
        return;
    }
    agenciaModel.excluir(Number(req.params.id))
        .then(function (resultado) {
            if (!resultado.affectedRows) {
                res.status(404).json({ mensagem: "Empresa não encontrada." });
                return;
            }
            res.status(204).end();
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "excluir a empresa"); });
}

module.exports = { listar, buscarPorId, criar, atualizar, excluir };
