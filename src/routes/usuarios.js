var express = require("express");
var router = express.Router();

var usuarioController = require("../controllers/usuarioController");
var sessoes = require("../auth/sessions");

router.post("/autenticar", function (req, res) {
    usuarioController.autenticar(req, res);
});

router.get("/sessao", sessoes.autenticar, function (req, res) {
    res.status(200).json(req.usuario);
});

router.post("/sair", sessoes.autenticar, sessoes.encerrar);

router.use(sessoes.autenticar, sessoes.exigirPerfil("gestor"));

router.get("/", function (req, res) {
    usuarioController.listarAgentes(req, res);
});

router.post("/", function (req, res) {
    usuarioController.cadastrar(req, res);
});

router.post("/cadastrar", function (req, res) {
    usuarioController.cadastrar(req, res);
});

router.get("/:id", function (req, res) {
    usuarioController.buscarAgentePorId(req, res);
});

router.put("/:id", function (req, res) {
    usuarioController.atualizarAgente(req, res);
});

router.delete("/:id", function (req, res) {
    usuarioController.excluirAgente(req, res);
});

module.exports = router;