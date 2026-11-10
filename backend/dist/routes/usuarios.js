"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../db/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Todas las rutas de este archivo requieren estar logueado
// y tener el rol "administrador" (RF-15: control de acceso por rol).
router.use(auth_1.requiereAutenticacion, (0, auth_1.requiereRol)("administrador"));
// GET /usuarios -> listar todos los usuarios del sistema
router.get("/", (req, res) => {
    const usuarios = database_1.db
        .prepare("SELECT id, nombre, email, rol, creadoEn FROM usuarios ORDER BY id DESC")
        .all();
    res.json({ usuarios, rolesDisponibles: database_1.ROLES });
});
// POST /usuarios -> crear un nuevo usuario (vendedor, almacén, logística, etc.)
router.post("/", (req, res) => {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password || !rol) {
        return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }
    if (!database_1.ROLES.includes(rol)) {
        return res.status(400).json({ error: "Rol inválido" });
    }
    const yaExiste = database_1.db.prepare("SELECT id FROM usuarios WHERE email = ?").get(email);
    if (yaExiste) {
        return res.status(409).json({ error: "Ya existe un usuario con ese email" });
    }
    const passwordHash = bcryptjs_1.default.hashSync(password, 10);
    const resultado = database_1.db
        .prepare("INSERT INTO usuarios (nombre, email, passwordHash, rol) VALUES (?, ?, ?, ?)")
        .run(nombre, email, passwordHash, rol);
    res.status(201).json({ id: resultado.lastInsertRowid, nombre, email, rol });
});
// PUT /usuarios/:id -> editar nombre, email y/o rol de un usuario
router.put("/:id", (req, res) => {
    const { id } = req.params;
    const { nombre, email, rol } = req.body;
    if (rol && !database_1.ROLES.includes(rol)) {
        return res.status(400).json({ error: "Rol inválido" });
    }
    const usuario = database_1.db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
    if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
    }
    database_1.db.prepare("UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?").run(nombre, email, rol, id);
    res.json({ mensaje: "Usuario actualizado" });
});
// DELETE /usuarios/:id -> eliminar un usuario
router.delete("/:id", (req, res) => {
    const { id } = req.params;
    const usuario = database_1.db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
    if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
    }
    database_1.db.prepare("DELETE FROM usuarios WHERE id = ?").run(id);
    res.json({ mensaje: "Usuario eliminado" });
});
exports.default = router;
