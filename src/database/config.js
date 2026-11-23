var mysql = require("mysql2");

// CONEXÃO DO BANCO MYSQL SERVER
var mySqlConfig = {
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
};

function executar(instrucao, valores = []) {
    if (process.env.AMBIENTE_PROCESSO !== "producao" && process.env.AMBIENTE_PROCESSO !== "desenvolvimento") {
        return Promise.reject(new Error("AMBIENTE NÃO CONFIGURADO EM .env"));
    }

    return new Promise(function (resolve, reject) {
        var conexao = mysql.createConnection(mySqlConfig);
        conexao.connect(function (erroConexao) {
            if (erroConexao) {
                conexao.end();
                reject(erroConexao);
                return;
            }

            conexao.query(instrucao, valores, function (erroConsulta, resultados) {
                conexao.end();
                if (erroConsulta) {
                    reject(erroConsulta);
                    return;
                }
                resolve(resultados);
            });
        });
    });
}

function transacao(operacao) {
    if (process.env.AMBIENTE_PROCESSO !== "producao" && process.env.AMBIENTE_PROCESSO !== "desenvolvimento") {
        return Promise.reject(new Error("AMBIENTE NÃO CONFIGURADO EM .env"));
    }

    return new Promise(function (resolve, reject) {
        var conexao = mysql.createConnection(mySqlConfig);
        conexao.connect(function (erroConexao) {
            if (erroConexao) {
                conexao.end();
                reject(erroConexao);
                return;
            }

            conexao.beginTransaction(function (erroTransacao) {
                if (erroTransacao) {
                    conexao.end();
                    reject(erroTransacao);
                    return;
                }

                function executarNaTransacao(instrucao, valores = []) {
                    return new Promise(function (resolveConsulta, rejectConsulta) {
                        conexao.query(instrucao, valores, function (erroConsulta, resultado) {
                            if (erroConsulta) {
                                rejectConsulta(erroConsulta);
                                return;
                            }
                            resolveConsulta(resultado);
                        });
                    });
                }

                Promise.resolve()
                    .then(function () {
                        return operacao(executarNaTransacao);
                    })
                    .then(function (resultado) {
                        conexao.commit(function (erroCommit) {
                            if (erroCommit) {
                                conexao.rollback(function () {
                                    conexao.end();
                                    reject(erroCommit);
                                });
                                return;
                            }
                            conexao.end();
                            resolve(resultado);
                        });
                    })
                    .catch(function (erro) {
                        conexao.rollback(function () {
                            conexao.end();
                            reject(erro);
                        });
                    });
            });
        });
    });
}

module.exports = {
    executar,
    transacao
};