var crypto = require("crypto");

var sessions = new Map();
var sessionLifetime = 8 * 60 * 60 * 1000;

function criarSessao(usuario) {
    var token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cargo: usuario.cargo,
        agenciaId: usuario.agenciaId || null,
        agencia: usuario.agencia || null,
        expiresAt: Date.now() + sessionLifetime
    });
    return token;
}

function autenticar(req, res, next) {
    var authorization = req.get("Authorization") || "";
    var token = authorization.match(/^Bearer ([a-f0-9]{64})$/i);
    var sessao = token && sessions.get(token[1]);

    if (!sessao || sessao.expiresAt <= Date.now()) {
        if (token) {
            sessions.delete(token[1]);
        }
        res.status(401).json({ mensagem: "Faça login para continuar." });
        return;
    }

    req.usuario = sessao;
    next();
}

function exigirPerfil() {
    var perfis = Array.prototype.slice.call(arguments);
    return function (req, res, next) {
        if (!req.usuario || perfis.indexOf(req.usuario.cargo) === -1) {
            res.status(403).json({ mensagem: "Seu perfil não tem permissão para esta ação." });
            return;
        }
        next();
    };
}

function encerrar(req, res) {
    var authorization = req.get("Authorization") || "";
    var token = authorization.match(/^Bearer ([a-f0-9]{64})$/i);
    if (token) {
        sessions.delete(token[1]);
    }
    res.status(204).end();
}

module.exports = { criarSessao, autenticar, exigirPerfil, encerrar };
