var usuarioModel = require("../models/usuarioModel");
var enviarErroBanco = require("../utils/responses").enviarErroBanco;
var criarSessao = require("../auth/sessions").criarSessao;
var pagination = require("../utils/pagination");

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

function dadosDoGestor(req) {
    var dados = Object.assign({}, req.body);
    delete dados.agenciaId;
    delete dados.fk_agencia;
    delete dados.idAgenciaServer;
    delete dados.fkAgenciaServer;
    dados.agenciaId = req.usuario.agenciaId;
    return dados;
}

function autenticar(req, res) {
    var body = req.body || {};
    var email = body.emailServer || body.email;
    var senha = body.senhaServer || body.senha;

    if (typeof email !== "string" || !email.trim()) {
        res.status(400).send("Seu email está undefined!");
    } else if (typeof senha !== "string" || !senha) {
        res.status(400).send("Sua senha está indefinida!");
    } else {
        email = email.trim();
        usuarioModel.autenticar(email, senha)
            .then(function (resultadoAutenticar) {
                if (resultadoAutenticar.length === 1) {
                    var usuario = resultadoAutenticar[0];
                    usuario.cargo = usuario.cargo === "administrador" ? "adm" : usuario.cargo;
                    usuario.token = criarSessao(usuario);
                    res.json(usuario);
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
    var dadosAgente = dadosDoGestor(req);
    var validacao = validarAgente(dadosAgente, true);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }

    var agente = validacao.valor;
    var agenciaId = req.usuario.agenciaId;

    usuarioModel.cadastrarAgente(agente.nome, agente.email, agente.senha, agenciaId)
        .then(function (id) {
            res.status(201).json({
                id: id,
                nome: agente.nome,
                email: agente.email,
                agenciaId: agenciaId,
                cargo: "Agente"
            });
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "cadastrar o agente");
        });
}

function listarAgentes(req, res) {
    var agenciaId = req.usuario.agenciaId || req.query.agenciaId;
    if (!agenciaId || !idValido(agenciaId)) {
        res.status(400).json({ mensagem: "Informe um id de agência válido." });
        return;
    }

    var paginacao = pagination.parseQuery(req, res);
    if (!paginacao) return;

    usuarioModel.listarAgentesPaginado(
        Number(agenciaId),
        paginacao.page,
        paginacao.pageSize
    )
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
            if (Number(resultado[0].agenciaId) !== Number(req.usuario.agenciaId)) {
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

    var dadosAgente = dadosDoGestor(req);
    var validacao = validarAgente(dadosAgente, false);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }

    var agente = validacao.valor;
    usuarioModel.buscarAgentePorId(Number(req.params.id))
        .then(function (existentes) {
            if (!existentes.length ||
                Number(existentes[0].agenciaId) !== Number(req.usuario.agenciaId)) {
                res.status(404).json({ mensagem: "Agente não encontrado." });
                return null;
            }
            return usuarioModel.atualizarAgente(Number(req.params.id), agente);
        })
        .then(function (atualizado) {
            if (atualizado === null) {
                return null;
            }
            return usuarioModel.buscarAgentePorId(Number(req.params.id));
        })
        .then(function (resultado) {
            if (resultado === null) {
                return;
            }
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

    usuarioModel.buscarAgentePorId(Number(req.params.id))
        .then(function (agentes) {
            if (!agentes.length ||
                Number(agentes[0].agenciaId) !== Number(req.usuario.agenciaId)) {
                res.status(404).json({ mensagem: "Agente não encontrado." });
                return null;
            }
            return usuarioModel.excluirAgente(
                Number(req.params.id),
                Number(req.usuario.agenciaId)
            );
        })
        .then(function (resultado) {
            if (!resultado) {
                return;
            }
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
    listarAgentes,
    buscarAgentePorId,
    atualizarAgente,
    excluirAgente
}