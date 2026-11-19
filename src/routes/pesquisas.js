var express = require("express");
var router = express.Router();
var pesquisaController = require("../controllers/pesquisaController");

router.get("/", pesquisaController.listar);
router.get("/:id", pesquisaController.buscarPorId);
router.post("/", pesquisaController.criar);
router.put("/:id", pesquisaController.atualizar);
router.delete("/:id", pesquisaController.excluir);

module.exports = router;
