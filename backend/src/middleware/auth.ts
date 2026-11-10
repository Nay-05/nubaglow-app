import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Rol } from "../db/database";

// En un proyecto real esto va en una variable de entorno (.env),
// nunca escrito directamente en el código.
export const JWT_SECRET = "nubaglow_clave_secreta_academica";

export type PayloadToken = {
  id: number;
  nombre: string;
  rol: Rol;
};

declare global {
  namespace Express {
    interface Request {
      usuario?: PayloadToken;
    }
  }
}

// Verifica que la petición traiga un token válido (usuario logueado)
export function requiereAutenticacion(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado" });
  }

  const token = header.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, JWT_SECRET) as PayloadToken;
    req.usuario = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

// Restringe una ruta a uno o más roles específicos.
// Ejemplo: requiereRol("administrador")
export function requiereRol(...rolesPermitidos: Rol[]) {
  return (req: Request, res: Response, next: NextFunction) => {
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
