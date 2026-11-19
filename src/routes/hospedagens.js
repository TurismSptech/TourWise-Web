var express = require("express");
var router = express.Router();
var hospedagemController = require("../controllers/hospedagemController");

router.get("/", hospedagemController.listar);
router.get("/:id", hospedagemController.buscarPorId);
router.post("/", hospedagemController.criar);
router.put("/:id", hospedagemController.atualizar);
router.delete("/:id", hospedagemController.excluir);

module.exports = router;
