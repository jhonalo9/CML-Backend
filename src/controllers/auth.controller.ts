import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { hashPassword, comparePassword, generateRandomToken } from '../utils/bcrypt.utils';
import { generateTokens } from '../utils/jwt.utils';
import { sendSuccess, sendError, sendCreated } from '../utils/response.utils';
import { registroSchema, loginSchema } from '../validators/auth.validator';
import { AppError } from '../middleware/error.middleware';
import  emailService  from '../services/email.service';
import { env } from '../config/env';

export const registro = async (req: Request, res: Response) => {
  try {
    // Validar datos
    const datosValidados = registroSchema.parse(req.body);

    // Verificar si es miembro en plena comunión
    if (!datosValidados.esMiembroPlenaComunion) {
      return sendError(
        res,
        'Solo miembros en plena comunión pueden registrarse',
        400
      );
    }

    // Verificar si email ya existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email: datosValidados.email }
    });

    if (usuarioExistente) {
      return sendError(res, 'El email ya está registrado', 400);
    }

    // Verificar si DNI ya existe
    const dniExistente = await prisma.usuario.findUnique({
      where: { dni: datosValidados.dni }
    });

    if (dniExistente) {
      return sendError(res, 'El DNI ya está registrado', 400);
    }

    // Hashear contraseña
    const passwordHash = await hashPassword(datosValidados.password);

    // Generar token de verificación
    const tokenVerificacion = generateRandomToken();

    // Crear usuario
    const usuario = await prisma.usuario.create({
      data: {
        ...datosValidados,
        password: passwordHash,
        fechaNacimiento: new Date(datosValidados.fechaNacimiento),
        tokenVerificacion,
        tipoUsuario: 'estudiante',
        // Auto-verificar en desarrollo
        verificado: env.NODE_ENV === 'development' ? true : false
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        dni: true,
        tipoUsuario: true,
        verificado: true
      }
    });

    // Enviar email de verificación (solo en producción)
    if (env.NODE_ENV !== 'development') {
      await emailService.sendVerificationEmail(usuario.email, tokenVerificacion);
    }

    return sendCreated(
      res,
      usuario,
      env.NODE_ENV === 'development'
        ? 'Usuario registrado y verificado exitosamente (modo desarrollo)'
        : 'Usuario registrado exitosamente. Por favor verifica tu email.'
    );
  } catch (error) {
    throw error;
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Buscar usuario
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        nombres: true,
        apellidos: true,
        tipoUsuario: true,
        estado: true,
        verificado: true
      }
    });

    if (!usuario) {
      return sendError(res, 'Credenciales inválidas', 401);
    }

    // Verificar contraseña
    const passwordValida = await comparePassword(password, usuario.password);

    if (!passwordValida) {
      return sendError(res, 'Credenciales inválidas', 401);
    }

    // Verificar estado
    if (usuario.estado !== 'activo') {
      return sendError(res, 'Usuario inactivo o suspendido', 403);
    }

    // Solo validar verificación en producción
    if (env.NODE_ENV !== 'development' && !usuario.verificado) {
      return sendError(res, 'Email no verificado', 403);
    }

    // Generar tokens
    const tokens = generateTokens({
      userId: usuario.id,
      email: usuario.email,
      tipoUsuario: usuario.tipoUsuario
    });

    // Actualizar último acceso
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() }
    });

    return sendSuccess(res, {
      usuario: {
        id: usuario.id,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        email: usuario.email,
        tipoUsuario: usuario.tipoUsuario
      },
      ...tokens
    }, 'Inicio de sesión exitoso');
  } catch (error) {
    throw error;
  }
};

export const verificarEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const usuario = await prisma.usuario.findFirst({
      where: { tokenVerificacion: token }
    });

    if (!usuario) {
      return sendError(res, 'Token de verificación inválido', 400);
    }

    if (usuario.verificado) {
      return sendError(res, 'Email ya verificado', 400);
    }

    // Actualizar usuario
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        verificado: true,
        tokenVerificacion: null
      }
    });

    // Enviar email de bienvenida
    await emailService.sendWelcomeEmail(
      usuario.email,
      `${usuario.nombres} ${usuario.apellidos}`
    );

    return sendSuccess(res, null, 'Email verificado exitosamente');
  } catch (error) {
    throw error;
  }
};

export const solicitarRecuperacion = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: { email }
    });

    // Por seguridad, siempre responder exitosamente
    if (!usuario) {
      return sendSuccess(
        res,
        null,
        'Si el email existe, recibirás instrucciones para recuperar tu contraseña'
      );
    }

    // Generar token de recuperación
    const tokenRecuperacion = generateRandomToken();
    const expiracion = new Date();
    expiracion.setHours(expiracion.getHours() + 1); // 1 hora

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        tokenRecuperacion,
        tokenExpiracion: expiracion
      }
    });

    // Enviar email
    await emailService.sendPasswordResetEmail(email, tokenRecuperacion);

    return sendSuccess(
      res,
      null,
      'Si el email existe, recibirás instrucciones para recuperar tu contraseña'
    );
  } catch (error) {
    throw error;
  }
};

export const restablecerPassword = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const usuario = await prisma.usuario.findFirst({
      where: {
        tokenRecuperacion: token,
        tokenExpiracion: {
          gte: new Date()
        }
      }
    });

    if (!usuario) {
      return sendError(res, 'Token inválido o expirado', 400);
    }

    // Actualizar contraseña
    const passwordHash = await hashPassword(password);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        password: passwordHash,
        tokenRecuperacion: null,
        tokenExpiracion: null
      }
    });

    return sendSuccess(res, null, 'Contraseña actualizada exitosamente');
  } catch (error) {
    throw error;
  }
};

export const perfil = async (req: Request, res: Response) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        sexo: true,
        dni: true,
        edad: true,
        fechaNacimiento: true,
        direccion: true,
        ciudad: true,
        pais: true,
        distritoPertenece: true,
        ocupacion: true,
        profesion: true,
        nivelEstudios: true,
        nombreIglesia: true,
        nombrePastor: true,
        telefono: true,
        fotoPerfil: true,
        tipoUsuario: true,
        fechaRegistro: true
      }
    });

    if (!usuario) {
      return sendError(res, 'Usuario no encontrado', 404);
    }

    return sendSuccess(res, usuario);
  } catch (error) {
    throw error;
  }
};

export const actualizarPerfil = async (req: Request, res: Response) => {
  try {
    const datosActualizacion = req.body;

    // No permitir actualizar campos críticos
    delete datosActualizacion.email;
    delete datosActualizacion.dni;
    delete datosActualizacion.password;
    delete datosActualizacion.tipoUsuario;

    const usuario = await prisma.usuario.update({
      where: { id: req.user!.id },
      data: datosActualizacion,
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        telefono: true,
        direccion: true,
        ciudad: true,
        pais: true
      }
    });

    return sendSuccess(res, usuario, 'Perfil actualizado exitosamente');
  } catch (error) {
    throw error;
  }
};