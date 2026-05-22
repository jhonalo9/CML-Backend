import { z } from 'zod';

export const registroSchema = z.object({
  nombres: z.string().min(2, 'Nombres debe tener al menos 2 caracteres'),
  apellidos: z.string().min(2, 'Apellidos debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
  sexo: z.enum(['Masculino', 'Femenino']),
  dni: z.string().length(8, 'DNI debe tener 8 dígitos'),
  edad: z.number().min(18, 'Debe ser mayor de 18 años').max(100),
  fechaNacimiento: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Fecha de nacimiento inválida'
  }),
  direccion: z.string().min(5, 'Dirección muy corta'),
  ciudad: z.string().min(2),
  pais: z.string().min(2),
  distritoPertenece: z.string().min(2),
  ocupacion: z.string().optional(),
  profesion: z.string().optional(),
  nivelEstudios: z.enum(['Primaria', 'Secundaria', 'Superior']),
  esMiembroPlenaComunion: z.boolean(),
  nombreIglesia: z.string().min(3),
  nombrePastor: z.string().min(3),
  telefono: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida')
});

export const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1, 'Contraseña actual requerida'),
  passwordNueva: z.string().min(6, 'Nueva contraseña debe tener al menos 6 caracteres'),
  confirmarPassword: z.string()
}).refine((data) => data.passwordNueva === data.confirmarPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmarPassword']
});

export const recuperarPasswordSchema = z.object({
  email: z.string().email('Email inválido')
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
  confirmarPassword: z.string()
}).refine((data) => data.password === data.confirmarPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmarPassword']
});