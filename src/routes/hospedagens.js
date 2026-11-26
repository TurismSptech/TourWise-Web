var express = require("express");
var router = express.Router();
var hospedagemController = require("../controllers/hospedagemController");
var sessoes = require("../auth/sessions");

router.use(sessoes.autenticar);
router.get("/tipos", hospedagemController.listarTipos);
router.get("/", hospedagemController.listar);
router.get("/:id", hospedagemController.buscarPorId);

module.exports = router;
