function enviarErroBanco(res, erro, contexto) {
    console.error("Houve um erro ao " + contexto + ":", erro.sqlMessage || erro);

    if (erro.code === "ER_DUP_ENTRY") {
        res.status(409).json({ mensagem: "Já existe um registro com esses dados únicos." });
        return;
    }

    if (erro.code === "ER_NO_REFERENCED_ROW_2") {
        res.status(400).json({ mensagem: "O registro relacionado informado não existe." });
        return;
    }

    if (erro.code === "ER_ROW_IS_REFERENCED_2") {
        res.status(409).json({ mensagem: "Não é possível excluir este registro enquanto houver dados relacionados." });
        return;
    }

    res.status(500).json({ mensagem: "Houve um erro ao " + contexto + "." });
}

module.exports = { enviarErroBanco };
