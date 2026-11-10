import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/database";
import { JWT_SECRET, requiereAutenticacion } from "../middleware/auth";

const router = Router();

// POST /auth/login -> autentica y devuelve un token con el rol del usuario
router.post("/login", (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña son obligatorios" });
  }

  const usuario = db
    .prepare("SELECT * FROM usuarios WHERE email = ?")
    .get(email) as
    | { id: number; nombre: string; email: string; passwordHash: string; rol: string }
    | undefined;

  if (!usuario) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const claveValida = bcrypt.compareSync(password, usuario.passwordHash);
  if (!claveValida) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const token = jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
  });
});

// GET /auth/perfil -> confirma quién está logueado (para el frontend)
router.get("/perfil", requiereAutenticacion, (req, res) => {
  res.json({ usuario: req.usuario });
});

export default router;
