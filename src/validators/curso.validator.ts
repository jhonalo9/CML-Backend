import { z } from 'zod';

export const crearCursoSchema = z.object({
  codigoCurso: z.string().min(3, 'Código de curso muy corto'),
  nombre: z.string().min(5, 'Nombre del curso muy corto'),
  descripcion: z.string().optional(),
  objetivos: z.string().optional(),
  numeroOrden: z.number().min(1).max(12),
  precio: z.number().min(0).default(80),
  esCurricular: z.boolean().default(true),
  totalUnidades: z.number().default(4),
  totalEvaluaciones: z.number().default(4),
  tieneExamenFinal: z.boolean().default(true),
  silaboUrl: z.string().url().optional(),
  imagenPortada: z.string().optional()
});

export const actualizarCursoSchema = crearCursoSchema.partial();

export const crearUnidadSchema = z.object({
  cursoId: z.number(),
  numeroUnidad: z.number().min(1).max(4),
  titulo: z.string().min(3),
  descripcion: z.string().optional(),
  objetivos: z.string().optional(),
  orden: z.number().min(1)
});

// En curso.validator.ts
export const crearContenidoSchema = z.object({
  unidadId: z.number(),
  titulo: z.string().min(3),
  descripcion: z.string().optional(),
  tipoContenido: z.enum(['pdf', 'video_zoom', 'diapositiva', 'otro']),
  // urlArchivo NO debe estar aquí cuando se sube archivo
  urlArchivo: z.string().optional(), // Hacer opcional
  tamanoMb: z.number().optional(),
  duracionMinutos: z.preprocess(
    (val) => val === '' || val === undefined ? 0 : Number(val),
    z.number().optional()
  ),
  orden: z.preprocess(
    (val) => val === '' || val === undefined ? 1 : Number(val),
    z.number().min(1)
  ),
  esContenidoAdicional: z.boolean().default(false)
});


export const crearEvaluacionSchema = z.object({
  cursoId: z.number(),
  unidadId: z.number().optional(),
  numeroEvaluacion: z.number().min(1).max(5),
  titulo: z.string().min(3),
  descripcion: z.string().optional(),
  tipo: z.enum(['evaluacion_unidad', 'examen_final']),
  puntuacionMaxima: z.number().default(20),
  puntuacionMinimaAprobacion: z.number().default(14),
  duracionMinutos: z.number().default(60),
  intentosPermitidos: z.number().default(1),
  fechaDisponible: z.string().optional(),
  fechaCierre: z.string().optional(),
  instrucciones: z.string().optional()
});

export const crearPreguntaSchema = z.object({
  evaluacionId: z.number(),
  pregunta: z.string().min(10),
  tipoPregunta: z.enum(['multiple_choice', 'verdadero_falso', 'desarrollo', 'completar']),
  opciones: z.any().optional(),
  respuestaCorrecta: z.string().optional(),
  puntos: z.number().min(0.5),
  orden: z.number().min(1),
  retroalimentacion: z.string().optional()
});

export const crearClaseZoomSchema = z.object({
  cursoId: z.number(),
  unidadId: z.number().optional(),
  titulo: z.string().min(3),
  descripcion: z.string().optional(),
  fechaHoraInicio: z.string().refine((date) => !isNaN(Date.parse(date))),
  fechaHoraFin: z.string().refine((date) => !isNaN(Date.parse(date))),
  urlZoom: z.string().url(),
  meetingId: z.string().optional(),
  passwordZoom: z.string().optional()
});