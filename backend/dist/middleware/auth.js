"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_SECRET = void 0;
exports.requiereAutenticacion = requiereAutenticacion;
exports.requiereRol = requiereRol;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// En un proyecto real esto va en una variable de entorno (.env),
// nunca escrito directamente en el código.
exports.JWT_SECRET = "nubaglow_clave_secreta_academica";
// Verifica que la petición traiga un token válido (usuario logueado)
function requiereAutenticacion(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autenticado" });
    }
    const token = header.replace("Bearer ", "");
    try {
        const payload = jsonwebtoken_1.default.verify(token, exports.JWT_SECRET);
        req.usuario = payload;
        next();
    }
    catch {
        return res.status(401).json({ error: "Token inválido o expirado" });
    }
}
// Restringe una ruta a uno o más roles específicos.
// Ejemplo: requiereRol("administrador")
function requiereRol(...rolesPermitidos) {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ error: "No autenticado" });
        }
        if (!rolesPermitidos.includes(req.usuario.rol)) {
            return res
                .status(403)
                .json({ error: "No tienes permisos para esta acción" });
        }
        next();
    };
}
