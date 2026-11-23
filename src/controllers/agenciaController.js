var agenciaModel = require("../models/agenciaModel");
var enviarErroBanco = require("../utils/responses").enviarErroBanco;
var pagination = require("../utils/pagination");

function idValido(valor) {
    return /^\d+$/.test(String(valor)) && Number(valor) > 0;
}

function validar(body, exigirSenha) {
    body = body || {};
    var nome = typeof body.nome === "string" ? body.nome.trim() : "";
    var email = typeof body.email === "string" ? body.email.trim() : "";
    var gestorEmail = typeof body.gestorEmail === "string" && body.gestorEmail.trim()
        ? body.gestorEmail.trim() : email;
    var senha = body.senha;

    if (!nome || nome.length > 45) {
        return { erro: "Informe o nome da agência com até 45 caracteres." };
    }
    if (!email || email.length > 45 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { erro: "Informe um email válido com até 45 caracteres." };
    }
    if (!gestorEmail || gestorEmail.length > 45 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gestorEmail)) {
        return { erro: "Informe um email válido para o acesso do Gestor." };
    }
    if ((exigirSenha || senha !== undefined) &&
        (typeof senha !== "string" || !senha || senha.length > 45)) {
        return { erro: "Informe uma senha com até 45 caracteres." };
    }
    return {
        valor: {
            nome: nome,
            email: email,
            gestorEmail: gestorEmail,
            senha: senha
        }
    };
}

function listar(req, res) {
    var paginacao = pagination.parseQuery(req, res);
    if (!paginacao) return;

    agenciaModel.listarPaginado(paginacao.page, paginacao.pageSize)
        .then(function (resultado) { res.status(200).json(resultado); })
        .catch(function (erro) { enviarErroBanco(res, erro, "listar as agências"); });
}

function buscarPorId(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de agência válido." });
        return;
    }
    agenciaModel.buscarPorId(Number(req.params.id))
        .then(function (resultado) {
            if (!resultado.length) {
                res.status(404).json({ mensagem: "Agência não encontrada." });
                return;
            }
            res.status(200).json(resultado[0]);
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "buscar a agência"); });
}

function criar(req, res) {
    var validacao = validar(req.body, true);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }
    agenciaModel.criar(validacao.valor)
        .then(function (resultado) {
            res.status(201).json({
                id: resultado.insertId,
                nome: validacao.valor.nome,
                email: validacao.valor.email
            });
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "cadastrar a agência"); });
}

function atualizar(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de agência válido." });
        return;
    }
    var validacao = validar(req.body, false);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }
    var id = Number(req.params.id);
    agenciaModel.atualizar(id, validacao.valor)
        .then(function () { return agenciaModel.buscarPorId(id); })
        .then(function (resultado) {
            if (!resultado.length) {
                res.status(404).json({ mensagem: "Agência não encontrada." });
                return;
            }
            res.status(200).json(resultado[0]);
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "atualizar a agência"); });
}

function excluir(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de agência válido." });
        return;
    }
    agenciaModel.excluir(Number(req.params.id))
        .then(function (resultado) {
            if (!resultado.affectedRows) {
                res.status(404).json({ mensagem: "Agência não encontrada." });
                return;
            }
            res.status(204).end();
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "excluir a agência"); });
}

module.exports = { listar, buscarPorId, criar, atualizar, excluir };
