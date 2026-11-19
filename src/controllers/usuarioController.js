var usuarioModel = require("../models/usuarioModel");
var enviarErroBanco = require("../utils/responses").enviarErroBanco;

function idValido(valor) {
    return /^\d+$/.test(String(valor)) && Number(valor) > 0;
}

function validarAgente(body, exigirSenha) {
    body = body || {};
    var nome = typeof body.nome === "string" ? body.nome.trim() : "";
    var email = body.emailServer || body.email;
    var senha = body.senhaServer || body.senha;
    var agenciaId = Number(body.idAgenciaServer || body.fkAgenciaServer || body.fk_agencia || body.agenciaId);

    if (!nome || nome.length > 45) {
        return { erro: "Informe o nome do agente com até 45 caracteres." };
    }
    if (typeof email !== "string" || !email.trim() || email.trim().length > 45 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return { erro: "Informe um email válido com até 45 caracteres." };
    }
    if ((exigirSenha || senha !== undefined) &&
        (typeof senha !== "string" || !senha || senha.length > 45)) {
        return { erro: "Informe uma senha com até 45 caracteres." };
    }
    if (!Number.isInteger(agenciaId) || agenciaId <= 0) {
        return { erro: "Selecione uma agência válida." };
    }

    return {
        valor: {
            nome: nome,
            email: email.trim(),
            senha: senha,
            agenciaId: agenciaId
        }
    };
}

function autenticar(req, res) {
    var email = req.body.emailServer || req.body.email;
    var senha = req.body.senhaServer || req.body.senha;

    if (typeof email !== "string" || !email.trim()) {
        res.status(400).send("Seu email está undefined!");
    } else if (typeof senha !== "string" || !senha) {
        res.status(400).send("Sua senha está indefinida!");
    } else {
        email = email.trim();
        usuarioModel.autenticar(email, senha)
            .then(function (resultadoAutenticar) {
                if (resultadoAutenticar.length === 1) {
                    res.json(resultadoAutenticar[0]);
                } else if (resultadoAutenticar.length === 0) {
                    res.status(403).send("Email e/ou senha inválido(s)");
                } else {
                    res.status(500).send("Mais de um usuário encontrado para este email.");
                }
            })
            .catch(function (erro) {
                console.error("\nHouve um erro ao realizar o login: ", erro.sqlMessage || erro);
                res.status(500).send("Houve um erro ao realizar o login.");
            });
    }
}

function cadastrar(req, res) {
    var validacao = validarAgente(req.body, true);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }

    var agente = validacao.valor;
    usuarioModel.cadastrar(agente.nome, agente.email, agente.senha, agente.agenciaId)
        .then(function (id) {
            res.status(201).json({
                id: id,
                nome: agente.nome,
                email: agente.email,
                agenciaId: agente.agenciaId,
                cargo: "Agente"
            });
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "cadastrar o agente");
        });
}

function listarAgencias(req, res) {
    usuarioModel.listarAgencias()
        .then(function (resultado) {
            res.json(resultado);
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "listar as agências");
        });
}

function listarAgentes(req, res) {
    var agenciaId = req.query.agenciaId;
    if (agenciaId !== undefined && !idValido(agenciaId)) {
        res.status(400).json({ mensagem: "Informe um id de agência válido." });
        return;
    }

    usuarioModel.listarAgentes(agenciaId ? Number(agenciaId) : null)
        .then(function (resultado) {
            res.status(200).json(resultado);
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "listar os agentes");
        });
}

function buscarAgentePorId(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de agente válido." });
        return;
    }

    usuarioModel.buscarAgentePorId(Number(req.params.id))
        .then(function (resultado) {
            if (resultado.length === 0) {
                res.status(404).json({ mensagem: "Agente não encontrado." });
                return;
            }
            res.status(200).json(resultado[0]);
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "buscar o agente");
        });
}

function atualizarAgente(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de agente válido." });
        return;
    }

    var validacao = validarAgente(req.body, false);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }

    var agente = validacao.valor;
    usuarioModel.atualizarAgente(Number(req.params.id), agente)
        .then(function () {
            return usuarioModel.buscarAgentePorId(Number(req.params.id));
        })
        .then(function (resultado) {
            if (resultado.length === 0) {
                res.status(404).json({ mensagem: "Agente não encontrado." });
                return;
            }
            res.status(200).json(resultado[0]);
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "atualizar o agente");
        });
}

function excluirAgente(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de agente válido." });
        return;
    }

    usuarioModel.excluirAgente(Number(req.params.id))
        .then(function (resultado) {
            if (resultado.affectedRows === 0) {
                res.status(404).json({ mensagem: "Agente não encontrado." });
                return;
            }
            res.status(204).end();
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "excluir o agente");
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
}