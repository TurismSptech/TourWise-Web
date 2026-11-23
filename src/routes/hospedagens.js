var express = require("express");
var router = express.Router();
var hospedagemController = require("../controllers/hospedagemController");
var sessoes = require("../auth/sessions");

router.use(sessoes.autenticar);
router.get("/tipos", hospedagemController.listarTipos);
router.get("/", hospedagemController.listar);
router.get("/:id", hospedagemController.buscarPorId);
router.post("/", sessoes.exigirPerfil("adm"), hospedagemController.criar);
router.put("/:id", sessoes.exigirPerfil("adm"), hospedagemController.atualizar);
router.delete("/:id", sessoes.exigirPerfil("adm"), hospedagemController.excluir);

module.exports = router;
