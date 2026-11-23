var express = require("express");
var router = express.Router();
var administradorController = require("../controllers/administradorController");
var sessoes = require("../auth/sessions");

router.use(sessoes.autenticar, sessoes.exigirPerfil("adm"));
router.get("/resumo", administradorController.resumo);
router.get("/", administradorController.listar);
router.get("/:id", administradorController.buscar);
router.post("/", administradorController.criar);
router.put("/:id", administradorController.atualizar);
router.delete("/:id", administradorController.excluir);

module.exports = router;
