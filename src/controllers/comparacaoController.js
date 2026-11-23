var hospedagemModel = require("../models/hospedagemModel");
var enviarErroBanco = require("../utils/responses").enviarErroBanco;
var pagination = require("../utils/pagination");

function avaliarHotel(hotel, destino, tipo, idioma, pessoas, precisaAcessibilidade, criterios) {
    var municipio = String(hotel.municipio || "").toLocaleLowerCase("pt-BR");
    var idiomas = String(hotel.idiomas || "").toLocaleLowerCase("pt-BR").split(",");
    var avaliacoes = {
        destino: municipio === destino.toLocaleLowerCase("pt-BR"),
        tipo: tipo ? String(hotel.tipoHospedagem || "").toLocaleLowerCase("pt-BR") === tipo.toLocaleLowerCase("pt-BR") : null,
        capacidade: hotel.leitos !== null && hotel.leitos !== undefined
            ? Number(hotel.leitos) >= pessoas : null,
        acessibilidade: precisaAcessibilidade
            ? hotel.leitosAcessiveis !== null && hotel.leitosAcessiveis !== undefined &&
                Number(hotel.leitosAcessiveis) >= pessoas
            : true,
        idioma: idioma ? idiomas.indexOf(idioma.toLocaleLowerCase("pt-BR")) !== -1 : null
    };
    var pesoConsiderado = 0;
    var pontos = 0;
    criterios.forEach(function (criterio) {
        if (!criterio.ativo || avaliacoes[criterio.nome] === null) {
            return;
        }
        pesoConsiderado += criterio.peso;
        if (avaliacoes[criterio.nome]) {
            pontos += criterio.peso;
        }
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

function comparar(req, res) {
    var body = req.body || {};
    var destino = typeof body.destino === "string" ? body.destino.trim() : "";
    var tipo = typeof body.tipoHospedagem === "string" ? body.tipoHospedagem.trim() : "";
    var idioma = typeof body.idioma === "string" ? body.idioma.trim() : "";
    var pessoas = Number(body.quantidadePessoas);
    var acessibilidade = body.precisaAcessibilidade;
    var hospedagemId = body.hospedagemId;
    var page = body.pagina === undefined ? 1 : Number(body.pagina);

    if (!destino || destino.length > 100) {
        res.status(400).json({ mensagem: "Informe o destino desejado." });
        return;
    }
    if (hospedagemId !== undefined && hospedagemId !== "" &&
        (!/^\d+$/.test(String(hospedagemId)) || Number(hospedagemId) < 1)) {
        res.status(400).json({ mensagem: "Selecione uma hospedagem válida." });
        return;
    }
    if (!Number.isSafeInteger(page) || page < 1) {
        res.status(400).json({ mensagem: "A página de recomendações deve ser um inteiro positivo." });
        return;
    }
    if (!Number.isInteger(pessoas) || pessoas < 1) {
        res.status(400).json({ mensagem: "Informe a quantidade de pessoas." });
        return;
    }
    if (acessibilidade !== true && acessibilidade !== false &&
        acessibilidade !== 0 && acessibilidade !== 1 &&
        acessibilidade !== "0" && acessibilidade !== "1") {
        res.status(400).json({ mensagem: "Informe se o cliente precisa de acessibilidade." });
        return;
    }

    var precisaAcessibilidade = acessibilidade === true ||
        acessibilidade === 1 || acessibilidade === "1";
    var criterios = [
        { nome: "destino", peso: 35, ativo: true },
        { nome: "tipo", peso: 15, ativo: Boolean(tipo) },
        { nome: "capacidade", peso: 20, ativo: true },
        { nome: "acessibilidade", peso: 20, ativo: true },
        { nome: "idioma", peso: 10, ativo: Boolean(idioma) }
    ];

    Promise.resolve().then(async function () {
        var metadata;
        var resultados = [];
        if (hospedagemId !== undefined && hospedagemId !== "") {
            var hoteisSelecionados = await hospedagemModel.buscarPorId(Number(hospedagemId));
            if (hoteisSelecionados.length === 0) {
                res.status(404).json({ mensagem: "A hospedagem selecionada não foi encontrada." });
                return;
            }
            resultados = [avaliarHotel(
                hoteisSelecionados[0], destino, tipo, idioma, pessoas, precisaAcessibilidade, criterios
            )];
            metadata = pagination.paginateArray(resultados, page, 10).pagination;
        } else {
            var countRows = await hospedagemModel.contar();
            var total = Number(countRows[0].total);
            metadata = pagination.response([], page, 10, total).pagination;
            var maxResultados = Math.min(metadata.page * 10, total);
            var cursor = 0;
            var processados = 0;
            var tamanhoLote = 100;

            while (processados < total) {
                var lote = await hospedagemModel.listarLotePorId(
                    cursor,
                    Math.min(tamanhoLote, total - processados)
                );
                if (lote.length === 0) break;

                cursor = Number(lote[lote.length - 1].id);
                processados += lote.length;
                resultados = resultados.concat(lote.map(function (hotel) {
                    return avaliarHotel(
                        hotel, destino, tipo, idioma, pessoas, precisaAcessibilidade, criterios
                    );
                })).sort(ordenarResultados).slice(0, maxResultados);
            }
            var inicio = (metadata.page - 1) * 10;
            resultados = resultados.slice(inicio, inicio + 10);
        }

        res.status(200).json({
            cliente: {
                nome: typeof body.nomeCliente === "string" ? body.nomeCliente.trim() : "",
                destino: destino,
                quantidadePessoas: pessoas,
                precisaAcessibilidade: precisaAcessibilidade,
                idioma: idioma || null
            },
            resultados: resultados,
            paginacao: metadata
        });
    }).catch(function (erro) {
        enviarErroBanco(res, erro, "comparar as hospedagens");
    });
}

module.exports = { comparar };
