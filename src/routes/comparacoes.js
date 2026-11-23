var express = require("express");
var router = express.Router();
var comparacaoController = require("../controllers/comparacaoController");
var sessoes = require("../auth/sessions");

router.post("/", sessoes.autenticar, sessoes.exigirPerfil("agente"), comparacaoController.comparar);

module.exports = router;
