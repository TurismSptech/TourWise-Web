var express = require("express");
var router = express.Router();
var gestorController = require("../controllers/gestorController");
var sessoes = require("../auth/sessions");

router.use(sessoes.autenticar, sessoes.exigirPerfil("adm"));
router.get("/empresas", gestorController.listarEmpresas);
router.get("/", gestorController.listar);
router.get("/:id", gestorController.buscar);
router.post("/", gestorController.salvar);
router.put("/:id", gestorController.salvar);
router.delete("/:id", gestorController.excluir);

module.exports = router;
