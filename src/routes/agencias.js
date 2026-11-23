var express = require("express");
var router = express.Router();
var agenciaController = require("../controllers/agenciaController");
var sessoes = require("../auth/sessions");

router.use(sessoes.autenticar, sessoes.exigirPerfil("adm"));
router.get("/", agenciaController.listar);
router.get("/:id", agenciaController.buscarPorId);
router.post("/", agenciaController.criar);
router.put("/:id", agenciaController.atualizar);
router.delete("/:id", agenciaController.excluir);

module.exports = router;
