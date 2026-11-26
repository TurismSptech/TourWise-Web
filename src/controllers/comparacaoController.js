var hospedagemModel = require("../models/hospedagemModel");
var recomendacaoModel = require("../models/recomendacaoModel");
var enviarErroBanco = require("../utils/responses").enviarErroBanco;
var pagination = require("../utils/pagination");

function erroValidacao(mensagem) {
    var erro = new Error(mensagem);
    erro.statusCode = 400;
    return erro;
}

function avaliarCriterios(hotel, cliente) {
    var municipio = String(hotel.municipio || "").toLocaleLowerCase("pt-BR");
    var idiomas = String(hotel.idiomas || "").toLocaleLowerCase("pt-BR").split(",");
    return {
        destino: municipio === cliente.destino.toLocaleLowerCase("pt-BR"),
        tipo: cliente.tipoHospedagem
            ? String(hotel.tipoHospedagem || "").toLocaleLowerCase("pt-BR") === cliente.tipoHospedagem.toLocaleLowerCase("pt-BR")
            : null,
        capacidade: hotel.leitos !== null && hotel.leitos !== undefined
            ? Number(hotel.leitos) >= cliente.quantidadePessoas : null,
        acessibilidade: cliente.precisaAcessibilidade
            ? hotel.leitosAcessiveis !== null && hotel.leitosAcessiveis !== undefined &&
                Number(hotel.leitosAcessiveis) >= cliente.quantidadePessoas
            : true,
        idioma: cliente.idioma
            ? idiomas.indexOf(cliente.idioma.toLocaleLowerCase("pt-BR")) !== -1 : null
    };
}

function avaliarHotel(hotel, cliente, criterios) {
    var avaliacoes = avaliarCriterios(hotel, cliente);
    var pesoConsiderado = 0;
    var pontos = 0;
    criterios.forEach(function (criterio) {
        if (!criterio.ativo || avaliacoes[criterio.nome] === null) return;
        pesoConsiderado += criterio.peso;
        if (avaliacoes[criterio.nome]) pontos += criterio.peso;
    });

    return {
        hospedagem: hotel,
        compatibilidade: pesoConsiderado ? Math.round((pontos / pesoConsiderado) * 100) : 0,
        criterios: avaliacoes
    };
}

function ordenarResultados(a, b) {
    return b.compatibilidade - a.compatibilidade ||
        String(a.hospedagem.nomeFantasia).localeCompare(String(b.hospedagem.nomeFantasia)) ||
        Number(a.hospedagem.id) - Number(b.hospedagem.id);
}

function validarPesquisa(body) {
    body = body || {};
    var cliente = {
        nomeCliente: typeof body.nomeCliente === "string" ? body.nomeCliente.trim() : "",
        destino: typeof body.destino === "string" ? body.destino.trim() : "",
        tipoHospedagem: typeof body.tipoHospedagem === "string" ? body.tipoHospedagem.trim() : "",
        quantidadePessoas: Number(body.quantidadePessoas),
        precisaAcessibilidade: body.precisaAcessibilidade === true ||
            body.precisaAcessibilidade === 1 || body.precisaAcessibilidade === "1" ||
            body.precisaAcessibilidade === "true",
        idioma: typeof body.idioma === "string" ? body.idioma.trim() : ""
    };

    if (!cliente.destino || cliente.destino.length > 100) {
        throw erroValidacao("Informe o destino desejado com até 100 caracteres.");
    }
    if (cliente.nomeCliente.length > 100 || cliente.tipoHospedagem.length > 70 || cliente.idioma.length > 45) {
        throw erroValidacao("Revise os limites de caracteres dos dados da pesquisa.");
    }
    if (!Number.isSafeInteger(cliente.quantidadePessoas) || cliente.quantidadePessoas < 1) {
        throw erroValidacao("Informe a quantidade de pessoas.");
    }
    if (body.precisaAcessibilidade !== true && body.precisaAcessibilidade !== false &&
        body.precisaAcessibilidade !== 0 && body.precisaAcessibilidade !== 1 &&
        body.precisaAcessibilidade !== "0" && body.precisaAcessibilidade !== "1" &&
        body.precisaAcessibilidade !== "true" && body.precisaAcessibilidade !== "false") {
        throw erroValidacao("Informe se o cliente precisa de acessibilidade.");
    }
    return cliente;
}

async function calcular(body) {
    var cliente = validarPesquisa(body);
    var criterios = [
        { nome: "destino", peso: 35, ativo: true },
        { nome: "tipo", peso: 15, ativo: Boolean(cliente.tipoHospedagem) },
        { nome: "capacidade", peso: 20, ativo: true },
        { nome: "acessibilidade", peso: 20, ativo: true },
        { nome: "idioma", peso: 10, ativo: Boolean(cliente.idioma) }
    ];
    var countRows = await hospedagemModel.contar();
    var total = Number(countRows[0].total);
    var resultados = [];
    var cursor = 0;
    var processados = 0;
    var tamanhoLote = 100;

    while (processados < total) {
        var lote = await hospedagemModel.listarLotePorId(
            cursor,
            Math.min(tamanhoLote, total - processados)
        );
        if (!lote.length) break;
        cursor = Number(lote[lote.length - 1].id);
        processados += lote.length;
        resultados = resultados.concat(lote.map(function (hotel) {
            return avaliarHotel(hotel, cliente, criterios);
        })).sort(ordenarResultados).slice(0, 3);
    }
    return { cliente: cliente, resultados: resultados };
}

async function comparar(req, res) {
    try {
        var analise = await calcular(req.body);
        var pesquisaId = analise.resultados.length
            ? await recomendacaoModel.salvar(req.usuario.id, analise.cliente, analise.resultados)
            : null;
        res.status(200).json({
            id: pesquisaId,
            cliente: analise.cliente,
            resultados: analise.resultados,
            paginacao: pagination.paginateArray(analise.resultados, 1, 3).pagination
        });
    } catch (erro) {
        if (erro.statusCode) {
            res.status(erro.statusCode).json({ mensagem: erro.message });
            return;
        }
        enviarErroBanco(res, erro, "gerar as recomendações");
    }
}

module.exports = { comparar, calcular, validarPesquisa, avaliarCriterios };
