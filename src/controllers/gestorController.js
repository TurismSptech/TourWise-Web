var gestorModel = require("../models/gestorModel");
var enviarErroBanco = require("../utils/responses").enviarErroBanco;
var pagination = require("../utils/pagination");

function idValido(valor) {
    return /^\d+$/.test(String(valor)) && Number(valor) > 0;
}

function validar(body, exigirSenha) {
    body = body || {};
    var nome = typeof body.nome === "string" ? body.nome.trim() : "";
    var email = typeof body.email === "string" ? body.email.trim() : "";
    var senha = body.senha;
    var empresaId = Number(body.empresaId);

    if (!nome || nome.length > 45) {
        return { erro: "Informe o nome do gestor com até 45 caracteres." };
    }
    if (!email || email.length > 45 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { erro: "Informe um email válido com até 45 caracteres." };
    }
    if ((exigirSenha || senha !== undefined) &&
        (typeof senha !== "string" || !senha || senha.length > 45)) {
        return { erro: "Informe uma senha com até 45 caracteres." };
    }
    if (!Number.isInteger(empresaId) || empresaId < 1) {
        return { erro: "Selecione uma empresa válida para o gestor." };
    }
    return { valor: { nome: nome, email: email, senha: senha, empresaId: empresaId } };
}

function listar(req, res) {
    var paginacao = pagination.parseQuery(req, res);
    if (!paginacao) return;
    gestorModel.listarPaginado(paginacao.page, paginacao.pageSize)
        .then(function (resultado) { res.status(200).json(resultado); })
        .catch(function (erro) { enviarErroBanco(res, erro, "listar os gestores"); });
}

function listarEmpresas(req, res) {
    gestorModel.listarEmpresas()
        .then(function (resultado) { res.status(200).json(resultado); })
        .catch(function (erro) { enviarErroBanco(res, erro, "listar as empresas"); });
}

function buscar(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de gestor válido." });
        return;
    }
    gestorModel.buscarPorId(Number(req.params.id))
        .then(function (resultado) {
            if (!resultado.length) {
                res.status(404).json({ mensagem: "Gestor não encontrado." });
                return;
            }
            res.status(200).json(resultado[0]);
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "buscar o gestor"); });
}

function salvar(req, res) {
    var id = req.params.id === undefined ? null : Number(req.params.id);
    if (id !== null && !idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de gestor válido." });
        return;
    }
    var validacao = validar(req.body, id === null);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }
    gestorModel.salvar(id, validacao.valor)
        .then(function (gestorId) {
            if (!gestorId) {
                res.status(404).json({ mensagem: "Gestor não encontrado." });
                return;
            }
            return gestorModel.buscarPorId(gestorId).then(function (resultado) {
                res.status(id === null ? 201 : 200).json(resultado[0]);
            });
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "salvar o gestor"); });
}

function excluir(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de gestor válido." });
        return;
    }
    gestorModel.excluir(Number(req.params.id))
        .then(function (resultado) {
            if (!resultado.affectedRows) {
                res.status(404).json({ mensagem: "Gestor não encontrado." });
                return;
            }
            res.status(204).end();
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "excluir o gestor"); });
}

module.exports = { listar, listarEmpresas, buscar, salvar, excluir };
