var usuarioModel = require("../models/usuarioModel");
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

    if (!nome || nome.length > 45) {
        return { erro: "Informe o nome do administrador com até 45 caracteres." };
    }
    if (!email || email.length > 45 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { erro: "Informe um email válido com até 45 caracteres." };
    }
    if ((exigirSenha || senha !== undefined) &&
        (typeof senha !== "string" || !senha || senha.length > 45)) {
        return { erro: "Informe uma senha com até 45 caracteres." };
    }
    return { valor: { nome: nome, email: email, senha: senha } };
}

function listar(req, res) {
    var paginacao = pagination.parseQuery(req, res);
    if (!paginacao) return;

    usuarioModel.listarAdministradoresPaginado(paginacao.page, paginacao.pageSize)
        .then(function (resultado) { res.status(200).json(resultado); })
        .catch(function (erro) { enviarErroBanco(res, erro, "listar os administradores"); });
}

function buscar(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de administrador válido." });
        return;
    }
    usuarioModel.buscarAdministradorPorId(Number(req.params.id))
        .then(function (resultado) {
            if (!resultado.length) {
                res.status(404).json({ mensagem: "Administrador não encontrado." });
                return;
            }
            res.status(200).json(resultado[0]);
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "buscar o administrador"); });
}

function criar(req, res) {
    var validacao = validar(req.body, true);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }
    var administrador = validacao.valor;
    usuarioModel.cadastrarAdministrador(administrador.nome, administrador.email, administrador.senha)
        .then(function (id) {
            res.status(201).json({
                id: id,
                nome: administrador.nome,
                email: administrador.email,
                cargo: "adm"
            });
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "cadastrar o administrador"); });
}

function atualizar(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de administrador válido." });
        return;
    }
    var validacao = validar(req.body, false);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }
    var id = Number(req.params.id);
    usuarioModel.atualizarAdministrador(id, validacao.valor)
        .then(function () { return usuarioModel.buscarAdministradorPorId(id); })
        .then(function (resultado) {
            if (!resultado.length) {
                res.status(404).json({ mensagem: "Administrador não encontrado." });
                return;
            }
            res.status(200).json(resultado[0]);
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "atualizar o administrador"); });
}

function excluir(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de administrador válido." });
        return;
    }
    if (Number(req.params.id) === Number(req.usuario.id)) {
        res.status(409).json({ mensagem: "Não é possível excluir a própria conta." });
        return;
    }
    usuarioModel.excluirAdministrador(Number(req.params.id))
        .then(function (resultado) {
            if (!resultado.affectedRows) {
                res.status(404).json({ mensagem: "Administrador não encontrado." });
                return;
            }
            res.status(204).end();
        })
        .catch(function (erro) { enviarErroBanco(res, erro, "excluir o administrador"); });
}

function resumo(req, res) {
    Promise.all([
        usuarioModel.contarPorPerfil(),
        require("../models/agenciaModel").contar(),
        require("../models/hospedagemModel").contar()
    ]).then(function (resultados) {
        var totais = {
            administradores: 0,
            agencias: Number(resultados[1][0].total),
            gestores: 0,
            agentes: 0,
            hospedagens: Number(resultados[2][0].total)
        };
        resultados[0].forEach(function (item) {
            if (item.cargo === "adm" || item.cargo === "administrador") {
                totais.administradores += Number(item.total);
            } else if (item.cargo === "gestor") {
                totais.gestores += Number(item.total);
            } else if (item.cargo === "agente") {
                totais.agentes += Number(item.total);
            }
        });
        res.status(200).json(totais);
    }).catch(function (erro) { enviarErroBanco(res, erro, "carregar o resumo administrativo"); });
}

module.exports = { listar, buscar, criar, atualizar, excluir, resumo };
