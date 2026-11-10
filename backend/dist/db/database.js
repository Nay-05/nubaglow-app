"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.ROLES = void 0;
const node_sqlite_1 = require("node:sqlite");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const path_1 = __importDefault(require("path"));
exports.ROLES = [
    "administrador",
    "vendedor",
    "almacen",
    "logistica",
    "cliente",
];
const dbPath = path_1.default.join(__dirname, "..", "nubaglow.sqlite");
exports.db = new node_sqlite_1.DatabaseSync(dbPath);
exports.db.exec(`
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
const totalUsuarios = exports.db
    .prepare("SELECT COUNT(*) as total FROM usuarios")
    .get();
if (totalUsuarios.total === 0) {
    const passwordHash = bcryptjs_1.default.hashSync("admin1234", 10);
    exports.db.prepare("INSERT INTO usuarios (nombre, email, passwordHash, rol) VALUES (?, ?, ?, ?)").run("Administradora Nuba", "admin@nuba.bo", passwordHash, "administrador");
    console.log("Usuario administrador creado -> email: admin@nuba.bo · contraseña: admin1234");
}
