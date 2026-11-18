/**
 * ============================================================================
 * NUBAGLOW APP - VISTA STAFF: USUARIOS (/staff/usuarios)
 * ============================================================================
 */

import { vistaEnConstruccion } from '../comunes.js';

export const vistaUsuarios = {
  async render() {
    return vistaEnConstruccion({
      titulo: 'Usuarios internos',
      descripcion:
        'Administracion de cuentas del personal: vendedores, operaciones y administradores.',
      fase: 10,
      puntos: [
        'Creacion de cuentas internas sin autorregistro publico.',
        'Activacion y desactivacion de accesos y restablecimiento de contrasenas.',
        'Proteccion del ultimo administrador activo y auditoria de cada cambio.'
      ]
    });
  }
};
