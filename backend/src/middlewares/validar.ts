/**
 * ============================================================================
 * NUBAGLOW APP - MIDDLEWARE DE VALIDACION CON ZOD
 * ============================================================================
 * Cumple con CLAUDE.md Seccion 9:
 * "Validar todos los req.body y req.params con Zod. Usar consultas parametrizadas al 100%."
 */

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

interface EsquemasValidacion {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

/**
 * Middleware de orden superior que valida body, query o params contra esquemas Zod.
 * Transfiere los datos validados y saneados de vuelta a la peticion.
 */
export function validar(esquemas: EsquemasValidacion) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (esquemas.body) {
        req.body = await esquemas.body.parseAsync(req.body);
      }
      if (esquemas.query) {
        req.query = (await esquemas.query.parseAsync(req.query)) as any;
      }
      if (esquemas.params) {
        req.params = (await esquemas.params.parseAsync(req.params)) as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(error);
      }
    }
  };
}
