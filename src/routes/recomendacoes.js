var express = require("express");
var router = express.Router();
var recomendacaoController = require("../controllers/recomendacaoController");
var sessoes = require("../auth/sessions");

router.use(sessoes.autenticar, sessoes.exigirPerfil("agente"));
router.get("/", recomendacaoController.listar);
router.get("/:id", recomendacaoController.buscar);
router.put("/:id", recomendacaoController.atualizar);
router.patch("/:id/status", recomendacaoController.alterarStatus);
router.patch("/:recomendacaoId/favorito", recomendacaoController.alterarFavorito);

module.exports = router;
