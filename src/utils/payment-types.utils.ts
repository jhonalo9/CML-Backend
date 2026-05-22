import { MetodoPago, TipoPago, EstadoPagoTransaccion } from '@prisma/client';


/**
 * Tipos de pago seguros
 */
export type MetodoPagoManual = Extract<MetodoPago, 'yape' | 'transferencia_bancaria'>;
export type MetodoPagoGateway = Extract<MetodoPago, 'stripe' | 'paypal' | 'mercado_pago'>;

/**
 * Validar y convertir método de pago manual
 */
export function validateMetodoPagoManual(metodoPago: string): MetodoPagoManual | null {
  const metodosValidos: MetodoPagoManual[] = ['yape', 'transferencia_bancaria'];
  
  if (metodosValidos.includes(metodoPago as MetodoPagoManual)) {
    return metodoPago as MetodoPagoManual;
  }
  
  return null;
}

/**
 * Validar y convertir método de pago gateway
 */
export function validateMetodoPagoGateway(metodoPago: string): MetodoPagoGateway | null {
  const metodosValidos: MetodoPagoGateway[] = ['stripe', 'paypal', 'mercado_pago'];
  
  if (metodosValidos.includes(metodoPago as MetodoPagoGateway)) {
    return metodoPago as MetodoPagoGateway;
  }
  
  return null;
}

/**
 * Verificar si un método de pago es manual
 */
export function isMetodoPagoManual(metodoPago: MetodoPago): metodoPago is MetodoPagoManual {
  return metodoPago === 'yape' || metodoPago === 'transferencia_bancaria';
}

/**
 * Verificar si un método de pago es gateway
 */
export function isMetodoPagoGateway(metodoPago: MetodoPago): metodoPago is MetodoPagoGateway {
  return metodoPago === 'stripe' || metodoPago === 'paypal' || metodoPago === 'mercado_pago';
}

/**
 * Validar tipo de pago
 */
export function validateTipoPago(tipoPago: string): TipoPago | null {
  const tiposValidos: TipoPago[] = ['matricula', 'curso', 'curso_adicional'];
  
  if (tiposValidos.includes(tipoPago as TipoPago)) {
    return tipoPago as TipoPago;
  }
  
  return null;
}

/**
 * Validar estado de pago
 */
export function validateEstadoPago(estado: string): EstadoPagoTransaccion | null {
  const estadosValidos: EstadoPagoTransaccion[] = [
    'pendiente',
    'pendiente_validacion',
    'procesando',
    'completado',
    'fallido',
    'reembolsado'
  ];
  
  if (estadosValidos.includes(estado as EstadoPagoTransaccion)) {
    return estado as EstadoPagoTransaccion;
  }
  
  return null;
}

/**
 * Obtener nombre legible del método de pago
 */
export function getNombreMetodoPago(metodoPago: MetodoPago): string {
  const nombres: Record<MetodoPago, string> = {
    yape: 'Yape',
    transferencia_bancaria: 'Transferencia Bancaria',
    stripe: 'Tarjeta de Crédito/Débito (Stripe)',
    paypal: 'PayPal',
    mercado_pago: 'Mercado Pago'
  };
  
  return nombres[metodoPago] || metodoPago;
}

/**
 * Obtener nombre legible del tipo de pago
 */
export function getNombreTipoPago(tipoPago: TipoPago): string {
  const nombres: Record<TipoPago, string> = {
    matricula: 'Matrícula',
    curso: 'Curso',
    curso_adicional: 'Curso Adicional'
  };
  
  return nombres[tipoPago] || tipoPago;
}

/**
 * Obtener nombre legible del estado de pago
 */
export function getNombreEstadoPago(estado: EstadoPagoTransaccion): string {
  const nombres: Record<EstadoPagoTransaccion, string> = {
    pendiente: 'Pendiente',
    pendiente_validacion: 'Pendiente de Validación',
    procesando: 'Procesando',
    completado: 'Completado',
    fallido: 'Fallido',
    reembolsado: 'Reembolsado'
  };
  
  return nombres[estado] || estado;
}

/**
 * Obtener clase de color para el estado de pago
 */
export function getColorEstadoPago(estado: EstadoPagoTransaccion): string {
  const colores: Record<EstadoPagoTransaccion, string> = {
    pendiente: 'text-yellow-600 bg-yellow-100',
    pendiente_validacion: 'text-orange-600 bg-orange-100',
    procesando: 'text-blue-600 bg-blue-100',
    completado: 'text-green-600 bg-green-100',
    fallido: 'text-red-600 bg-red-100',
    reembolsado: 'text-gray-600 bg-gray-100'
  };
  
  return colores[estado] || 'text-gray-600 bg-gray-100';
}