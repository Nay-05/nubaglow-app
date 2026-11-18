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
        'Administración de cuentas del personal: vendedores, operaciones y administradores.',
      fase: 10,
      puntos: [
        'Creación de cuentas internas sin autorregistro público.',
        'Activación y desactivación de accesos y restablecimiento de contraseñas.',
        'Protección del último administrador activo y auditoría de cada cambio.'
      ]
    });
  }
};
