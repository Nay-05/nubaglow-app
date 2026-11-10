import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import path from "path";

// Roles definidos según el documento de especificación (RBAC):
// Cliente, Vendedor/Cajero, Gestor de Inventario, Encargado de Logística, Administrador
export type Rol =
  | "administrador"
  | "vendedor"
  | "almacen"
  | "logistica"
  | "cliente";

export const ROLES: Rol[] = [
  "administrador",
  "vendedor",
  "almacen",
  "logistica",
  "cliente",
];

const dbPath = path.join(__dirname, "..", "nubaglow.sqlite");
export const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    rol TEXT NOT NULL,
    creadoEn TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Sembramos un usuario administrador inicial si la tabla está vacía,
// para poder entrar por primera vez y crear al resto de usuarios.
const totalUsuarios = db
  .prepare("SELECT COUNT(*) as total FROM usuarios")
  .get() as { total: number };

if (totalUsuarios.total === 0) {
  const passwordHash = bcrypt.hashSync("admin1234", 10);
  db.prepare(
    "INSERT INTO usuarios (nombre, email, passwordHash, rol) VALUES (?, ?, ?, ?)"
  ).run("Administradora Nuba", "admin@nuba.bo", passwordHash, "administrador");
  console.log(
    "Usuario administrador creado -> email: admin@nuba.bo · contraseña: admin1234"
  );
}
