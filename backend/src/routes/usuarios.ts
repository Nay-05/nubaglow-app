import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, ROLES, Rol } from "../db/database";
import { requiereAutenticacion, requiereRol } from "../middleware/auth";

const router = Router();

// Todas las rutas de este archivo requieren estar logueado
// y tener el rol "administrador" (RF-15: control de acceso por rol).
router.use(requiereAutenticacion, requiereRol("administrador"));

// GET /usuarios -> listar todos los usuarios del sistema
router.get("/", (req, res) => {
  const usuarios = db
    .prepare("SELECT id, nombre, email, rol, creadoEn FROM usuarios ORDER BY id DESC")
    .all();
  res.json({ usuarios, rolesDisponibles: ROLES });
});

// POST /usuarios -> crear un nuevo usuario (vendedor, almacén, logística, etc.)
router.post("/", (req, res) => {
  const { nombre, email, password, rol } = req.body as {
    nombre: string;
    email: string;
    password: string;
    rol: Rol;
  };

  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }
  if (!ROLES.includes(rol)) {
    return res.status(400).json({ error: "Rol inválido" });
  }

  const yaExiste = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(email);
  if (yaExiste) {
    return res.status(409).json({ error: "Ya existe un usuario con ese email" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const resultado = db
    .prepare(
      "INSERT INTO usuarios (nombre, email, passwordHash, rol) VALUES (?, ?, ?, ?)"
    )
    .run(nombre, email, passwordHash, rol);

  res.status(201).json({ id: resultado.lastInsertRowid, nombre, email, rol });
});

// PUT /usuarios/:id -> editar nombre, email y/o rol de un usuario
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { nombre, email, rol } = req.body as { nombre: string; email: string; rol: Rol };

  if (rol && !ROLES.includes(rol)) {
    return res.status(400).json({ error: "Rol inválido" });
  }

  const usuario = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
  if (!usuario) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  db.prepare("UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?").run(
    nombre,
    email,
    rol,
    id
  );

  res.json({ mensaje: "Usuario actualizado" });
});

// DELETE /usuarios/:id -> eliminar un usuario
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  const usuario = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
  if (!usuario) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  db.prepare("DELETE FROM usuarios WHERE id = ?").run(id);
  res.json({ mensaje: "Usuario eliminado" });
});

export default router;
