/**
 * Utilidades para manejo de fechas en la aplicación
 * Evita problemas de zona horaria al mostrar fechas de base de datos
 */

import { formatDateInUserTimezone, formatDateTimeInUserTimezone } from './timezoneUtils';

/**
 * Parsea una fecha desde la base de datos sin conversión UTC
 * Esto previene el desfase de horas al mostrar fechas
 */
export const parseLocalDate = (dateString: string): Date => {
  // Manejar tanto "YYYY-MM-DD HH:mm:ss" como "YYYY-MM-DDTHH:mm:ss.sssZ"
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [_, year, month, day, hour, minute, second] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  }
  return new Date(dateString);
};

/**
 * Formatea un objeto Date a formato PostgreSQL sin conversión UTC
 * Esto previene el desfase de horas al guardar fechas
 * Formato: YYYY-MM-DD HH:mm:ss
 */
export const formatLocalDateTime = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

/**
 * Formatea una fecha en formato YYYY-MM-DD a DD/MM/YYYY
 * Útil para fechas almacenadas en base de datos sin componente de tiempo
 * Usa la zona horaria configurada por el usuario
 */
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  
  // Si es una fecha simple (YYYY-MM-DD), usar función con timezone
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return formatDateInUserTimezone(dateString + 'T00:00:00');
  }
  
  // Si tiene timestamp, usar función con timezone
  return formatDateInUserTimezone(dateString);
};

/**
 * Formatea un timestamp completo a fecha y hora
 * Usa la zona horaria configurada por el usuario
 */
export const formatDateTime = (dateString: string | null | undefined): string => {
  return formatDateTimeInUserTimezone(dateString);
};

/**
 * Retorna la fecha tal cual está en la base de datos (YYYY-MM-DD)
 * Sin ninguna transformación
 */
export const getRawDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  
  // Si es un date puro (sin tiempo), retornar tal cual
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  // Si tiene timestamp, extraer solo la parte de fecha
  return dateString.split('T')[0];
};

/**
 * Obtiene la fecha de un timestamp en la zona horaria local del navegador
 * en formato YYYY-MM-DD (útil para comparar con inputs type="date")
 */
export const getLocalDateFromTimestamp = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  
  // Si es un date puro (sin tiempo), retornar tal cual
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  // Convertir el timestamp a fecha local
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Formatea una fecha simple (YYYY-MM-DD) a DD/MM/YYYY
 * Sin conversiones de zona horaria - útil para fechas de cuotas, vencimientos, etc.
 */
export const formatSimpleDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  
  // Extraer la parte de fecha si es un timestamp
  const dateOnly = dateString.includes('T') ? dateString.split('T')[0] : dateString;
  
  // Validar formato YYYY-MM-DD
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateString;
  
  const [_, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando la fecha local del navegador
 * Sin conversiones UTC que causan desfases de zona horaria
 */
export const getTodayInPeru = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Convierte una fecha local del navegador a formato YYYY-MM-DD
 * asegurándose de usar la fecha local sin conversión UTC
 */
export const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Suma días a una fecha manteniendo zona horaria local
 */
export const addDaysToDate = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  
  return getLocalDateString(date);
};
