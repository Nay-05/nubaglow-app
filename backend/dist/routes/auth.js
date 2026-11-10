"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../db/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /auth/login -> autentica y devuelve un token con el rol del usuario
router.post("/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email y contraseña son obligatorios" });
    }
    const usuario = database_1.db
        .prepare("SELECT * FROM usuarios WHERE email = ?")
        .get(email);
    if (!usuario) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
    }
    const claveValida = bcryptjs_1.default.compareSync(password, usuario.passwordHash);
    if (!claveValida) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
    }
    const token = jsonwebtoken_1.default.sign({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }, auth_1.JWT_SECRET, { expiresIn: "8h" });
    res.json({
        token,
        usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    });
});
// GET /auth/perfil -> confirma quién está logueado (para el frontend)
router.get("/perfil", auth_1.requiereAutenticacion, (req, res) => {
    res.json({ usuario: req.usuario });
});
exports.default = router;
