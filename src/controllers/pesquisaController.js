var pesquisaModel = require("../models/pesquisaModel");
var enviarErroBanco = require("../utils/responses").enviarErroBanco;

function idValido(valor) {
    return /^\d+$/.test(String(valor)) && Number(valor) > 0;
}

function dataValida(valor) {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return false;
    }
    var data = new Date(valor + "T00:00:00Z");
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function campo(body, snakeCase, camelCase) {
    return body[snakeCase] !== undefined ? body[snakeCase] : body[camelCase];
}

function validarPesquisa(body) {
    body = body || {};
    var nomeCliente = campo(body, "nome_cliente", "nomeCliente");
    var preferenciaLugar = campo(body, "preferencia_lugar", "preferenciaLugar");
    var quantidadePessoas = campo(body, "quantidade_pessoas", "quantidadePessoas");
    var precisaAcessibilidade = campo(body, "precisa_acessibilidade", "precisaAcessibilidade");
    var dataViagem = campo(body, "dt_viagem", "dataViagem");
    var usuarioId = Number(campo(body, "fk_usuario", "usuarioId"));

    if (typeof nomeCliente !== "string" || !nomeCliente.trim() || nomeCliente.trim().length > 45) {
        return { erro: "Informe o nome do cliente com até 45 caracteres." };
    }
    if (typeof preferenciaLugar !== "string" ||
        !preferenciaLugar.trim() || preferenciaLugar.trim().length > 45) {
        return { erro: "Informe o destino desejado com até 45 caracteres." };
    }
    if (!Number.isInteger(Number(quantidadePessoas)) || Number(quantidadePessoas) < 1) {
        return { erro: "A quantidade de pessoas deve ser um inteiro positivo." };
    }
    if (precisaAcessibilidade !== true && precisaAcessibilidade !== false &&
        precisaAcessibilidade !== 0 && precisaAcessibilidade !== 1 &&
        precisaAcessibilidade !== "0" && precisaAcessibilidade !== "1") {
        return { erro: "Informe se o cliente precisa de acessibilidade." };
    }
    if (typeof body.idioma !== "string" || !body.idioma.trim() || body.idioma.trim().length > 45) {
        return { erro: "Informe o idioma com até 45 caracteres." };
    }
    if (!dataValida(dataViagem)) {
        return { erro: "A data da viagem deve seguir o formato AAAA-MM-DD." };
    }
    if (!idValido(usuarioId)) {
        return { erro: "Informe um id de agente válido." };
    }

    return {
        valor: {
            nomeCliente: nomeCliente.trim(),
            preferenciaLugar: preferenciaLugar.trim(),
            quantidadePessoas: Number(quantidadePessoas),
            precisaAcessibilidade: precisaAcessibilidade === true ||
                precisaAcessibilidade === 1 || precisaAcessibilidade === "1" ? 1 : 0,
            idioma: body.idioma.trim(),
            dataViagem: dataViagem,
            usuarioId: usuarioId
        }
    };
}

function listar(req, res) {
    var usuarioId = req.query.usuarioId;
    if (usuarioId !== undefined && !idValido(usuarioId)) {
        res.status(400).json({ mensagem: "Informe um id de agente válido." });
        return;
    }

    pesquisaModel.listar(usuarioId ? Number(usuarioId) : null)
        .then(function (resultado) {
            res.status(200).json(resultado);
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "listar as pesquisas de clientes");
        });
}

function buscarPorId(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de pesquisa válido." });
        return;
    }

    pesquisaModel.buscarPorId(Number(req.params.id))
        .then(function (resultado) {
            if (resultado.length === 0) {
                res.status(404).json({ mensagem: "Pesquisa não encontrada." });
                return;
            }
            res.status(200).json(resultado[0]);
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "buscar a pesquisa do cliente");
        });
}

function criar(req, res) {
    var validacao = validarPesquisa(req.body);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }

    pesquisaModel.criar(validacao.valor)
        .then(function (resultado) {
            return pesquisaModel.buscarPorId(resultado.insertId);
        })
        .then(function (resultado) {
            res.status(201).json(resultado[0]);
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "cadastrar a pesquisa do cliente");
        });
}

function atualizar(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de pesquisa válido." });
        return;
    }
    var validacao = validarPesquisa(req.body);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }

    var id = Number(req.params.id);
    pesquisaModel.atualizar(id, validacao.valor)
        .then(function () {
            return pesquisaModel.buscarPorId(id);
        })
        .then(function (resultado) {
            if (resultado.length === 0) {
                res.status(404).json({ mensagem: "Pesquisa não encontrada." });
                return;
            }
            res.status(200).json(resultado[0]);
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "atualizar a pesquisa do cliente");
        });
}

function excluir(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de pesquisa válido." });
        return;
    }

    pesquisaModel.excluir(Number(req.params.id))
        .then(function (resultado) {
            if (resultado.affectedRows === 0) {
                res.status(404).json({ mensagem: "Pesquisa não encontrada." });
                return;
            }
            res.status(204).end();
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "excluir a pesquisa do cliente");
        });
}

module.exports = { listar, buscarPorId, criar, atualizar, excluir };
