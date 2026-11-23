var hospedagemModel = require("../models/hospedagemModel");
var enviarErroBanco = require("../utils/responses").enviarErroBanco;
var pagination = require("../utils/pagination");

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

function opcionalTexto(valor, limite, rotulo) {
    if (valor === undefined || valor === null || valor === "") {
        return { valor: null };
    }
    if (typeof valor !== "string" || valor.trim().length > limite) {
        return { erro: "O campo " + rotulo + " deve ter até " + limite + " caracteres." };
    }
    return { valor: valor.trim() };
}

function opcionalInteiro(valor, rotulo) {
    if (valor === undefined || valor === null || valor === "") {
        return { valor: null };
    }
    var numero = Number(valor);
    if (!Number.isInteger(numero) || numero < 0) {
        return { erro: "O campo " + rotulo + " deve ser um número inteiro não negativo." };
    }
    return { valor: numero };
}

function validarHospedagem(body) {
    body = body || {};
    var nomeFantasia = campo(body, "nome_fantasia", "nomeFantasia");
    var tipoHospedagem = campo(body, "tipo_hospedagem", "tipoHospedagem");
    var municipio = body.municipio;
    var uf = body.uf;

    if (typeof nomeFantasia !== "string" || !nomeFantasia.trim() || nomeFantasia.trim().length > 200) {
        return { erro: "Informe o nome da hospedagem com até 200 caracteres." };
    }
    if (typeof tipoHospedagem !== "string" || !tipoHospedagem.trim() || tipoHospedagem.trim().length > 70) {
        return { erro: "Informe o tipo de hospedagem com até 70 caracteres." };
    }
    if (typeof municipio !== "string" || !municipio.trim() || municipio.trim().length > 100) {
        return { erro: "Informe o município com até 100 caracteres." };
    }
    if (typeof uf !== "string" || !/^[A-Za-z]{2}$/.test(uf.trim())) {
        return { erro: "Informe uma UF válida com duas letras." };
    }

    var cnpj = body.cnpj === undefined || body.cnpj === null || body.cnpj === ""
        ? null
        : String(body.cnpj).replace(/\D/g, "");
    if (cnpj !== null && cnpj.length !== 14) {
        return { erro: "O CNPJ deve conter 14 dígitos." };
    }

    var emailComercial = campo(body, "email_comercial", "emailComercial");
    if (emailComercial !== undefined && emailComercial !== null && emailComercial !== "" &&
        (typeof emailComercial !== "string" ||
         !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailComercial.trim()) ||
         emailComercial.trim().length > 100)) {
        return { erro: "Informe um email comercial válido com até 100 caracteres." };
    }

    var definicoes = [
        ["uni_habit", "unidadesHabitacionais", "unidades habitacionais"],
        ["leitos", "leitos", "leitos"],
        ["uni_habit_acess", "unidadesAcessiveis", "unidades acessíveis"],
        ["leito_acess", "leitosAcessiveis", "leitos acessíveis"]
    ];
    var quantidades = {};
    for (var i = 0; i < definicoes.length; i++) {
        var valor = campo(body, definicoes[i][0], definicoes[i][1]);
        var resultado = opcionalInteiro(valor, definicoes[i][2]);
        if (resultado.erro) {
            return resultado;
        }
        quantidades[definicoes[i][1]] = resultado.valor;
    }

    if (quantidades.unidadesAcessiveis !== null && quantidades.unidadesHabitacionais !== null &&
        quantidades.unidadesAcessiveis > quantidades.unidadesHabitacionais) {
        return { erro: "Unidades acessíveis não podem exceder as unidades habitacionais." };
    }
    if (quantidades.leitosAcessiveis !== null && quantidades.leitos !== null &&
        quantidades.leitosAcessiveis > quantidades.leitos) {
        return { erro: "Leitos acessíveis não podem exceder o total de leitos." };
    }

    var textos = [
        ["endereco", "endereco", 300, "endereço"],
        ["website", "website", 150, "website"],
        ["porte", "porte", 60, "porte"],
        ["dt_abertura", "dataAbertura", 10, "data de abertura"]
    ];
    var opcionais = {};
    for (var j = 0; j < textos.length; j++) {
        var texto = campo(body, textos[j][0], textos[j][1]);
        var textoResultante = opcionalTexto(texto, textos[j][2], textos[j][3]);
        if (textoResultante.erro) {
            return textoResultante;
        }
        opcionais[textos[j][1]] = textoResultante.valor;
    }

    if (opcionais.dataAbertura && !dataValida(opcionais.dataAbertura)) {
        return { erro: "A data de abertura deve seguir o formato AAAA-MM-DD." };
    }

    return {
        valor: {
            cnpj: cnpj,
            tipoHospedagem: tipoHospedagem.trim(),
            nomeFantasia: nomeFantasia.trim(),
            emailComercial: emailComercial ? emailComercial.trim() : null,
            unidadesHabitacionais: quantidades.unidadesHabitacionais,
            leitos: quantidades.leitos,
            unidadesAcessiveis: quantidades.unidadesAcessiveis,
            leitosAcessiveis: quantidades.leitosAcessiveis,
            dataAbertura: opcionais.dataAbertura,
            website: opcionais.website,
            porte: opcionais.porte,
            endereco: opcionais.endereco,
            municipio: municipio.trim(),
            uf: uf.trim().toUpperCase()
        }
    };
}

function listar(req, res) {
    var busca = req.query.busca;
    var municipio = req.query.municipio;
    var tipoHospedagem = req.query.tipoHospedagem;
    if ((busca !== undefined && typeof busca !== "string") ||
        (municipio !== undefined && typeof municipio !== "string") ||
        (tipoHospedagem !== undefined && typeof tipoHospedagem !== "string")) {
        res.status(400).json({ mensagem: "Os filtros busca, municipio e tipoHospedagem devem ser textos." });
        return;
    }

    var paginacao = pagination.parseQuery(req, res);
    if (!paginacao) return;

    hospedagemModel.listarPaginado({
        busca: busca ? busca.trim() : "",
        municipio: municipio ? municipio.trim() : "",
        tipoHospedagem: tipoHospedagem ? tipoHospedagem.trim() : ""
    }, paginacao.page, paginacao.pageSize).then(function (resultado) {
        res.status(200).json(resultado);
    }).catch(function (erro) {
        enviarErroBanco(res, erro, "listar as hospedagens");
    });
}

function listarTipos(req, res) {
    hospedagemModel.listarTipos()
        .then(function (resultado) { res.status(200).json(resultado); })
        .catch(function (erro) { enviarErroBanco(res, erro, "listar os tipos de hospedagem"); });
}

function buscarPorId(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de hospedagem válido." });
        return;
    }

    hospedagemModel.buscarPorId(Number(req.params.id))
        .then(function (resultado) {
            if (resultado.length === 0) {
                res.status(404).json({ mensagem: "Hospedagem não encontrada." });
                return;
            }
            res.status(200).json(resultado[0]);
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "buscar a hospedagem");
        });
}

function criar(req, res) {
    var validacao = validarHospedagem(req.body);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }

    hospedagemModel.criar(validacao.valor)
        .then(function (id) {
            return hospedagemModel.buscarPorId(id);
        })
        .then(function (resultado) {
            res.status(201).json(resultado[0]);
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "cadastrar a hospedagem");
        });
}

function atualizar(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de hospedagem válido." });
        return;
    }
    var validacao = validarHospedagem(req.body);
    if (validacao.erro) {
        res.status(400).json({ mensagem: validacao.erro });
        return;
    }

    var id = Number(req.params.id);
    hospedagemModel.atualizar(id, validacao.valor)
        .then(function () {
            return hospedagemModel.buscarPorId(id);
        })
        .then(function (resultado) {
            if (resultado.length === 0) {
                res.status(404).json({ mensagem: "Hospedagem não encontrada." });
                return;
            }
            res.status(200).json(resultado[0]);
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "atualizar a hospedagem");
        });
}

function excluir(req, res) {
    if (!idValido(req.params.id)) {
        res.status(400).json({ mensagem: "Informe um id de hospedagem válido." });
        return;
    }

    hospedagemModel.excluir(Number(req.params.id))
        .then(function (resultado) {
            if (resultado.affectedRows === 0) {
                res.status(404).json({ mensagem: "Hospedagem não encontrada." });
                return;
            }
            res.status(204).end();
        })
        .catch(function (erro) {
            enviarErroBanco(res, erro, "excluir a hospedagem");
        });
}

module.exports = { listar, listarTipos, buscarPorId, criar, atualizar, excluir };
