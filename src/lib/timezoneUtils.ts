/**
 * Utilidades para manejo de zonas horarias
 * Formatea fechas según la preferencia de zona horaria del usuario
 * 
 * IMPORTANTE: Todas las fechas se guardan en hora de Perú (America/Lima)
 * pero se muestran convertidas a la zona horaria del usuario
 */

/**
 * Obtiene la zona horaria del usuario desde localStorage
 * o retorna la zona por defecto (America/Lima - Perú)
 */
export const getUserTimezone = (): string => {
  try {
    const storedTimezone = localStorage.getItem('userTimezone');
    return storedTimezone || 'America/Lima';
  } catch {
    return 'America/Lima';
  }
};

/**
 * Guarda la zona horaria del usuario en localStorage
 */
export const setUserTimezone = (timezone: string): void => {
  try {
    localStorage.setItem('userTimezone', timezone);
  } catch (error) {
    console.error('Error saving timezone:', error);
  }
};

/**
 * Formatea una fecha SIMPLE (solo día) SIN conversión de zona horaria
 * Usar para fechas que no tienen hora específica (ej: fecha de inicio de curso)
 * @param dateString - Fecha en formato YYYY-MM-DD o ISO
 * @returns Fecha formateada como DD/MM/YYYY
 */
export const formatSimpleDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  
  try {
    // Extraer solo la parte de fecha (YYYY-MM-DD)
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-');
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting simple date:', error);
    return '-';
  }
};

/**
 * Formatea una fecha según la zona horaria del usuario
 * Las fechas vienen en hora de Perú y se convierten a la zona del usuario
 * @param dateString - Fecha en formato ISO o string de PostgreSQL (en hora de Perú)
 * @param options - Opciones de formato Intl.DateTimeFormat
 * @returns Fecha formateada en la zona horaria del usuario
 */
export const formatDateInUserTimezone = (
  dateString: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string => {
  if (!dateString) return '-';
  
  try {
    // Parsear la fecha asumiendo que viene en hora de Perú
    let date: Date;
    
    if (dateString.includes('T') || dateString.includes(' ')) {
      // Tiene hora - parsear normalmente
      date = new Date(dateString);
    } else {
      // Solo fecha (YYYY-MM-DD) - añadir hora en Perú
      date = new Date(dateString + 'T12:00:00-05:00'); // Mediodía en hora de Perú
    }
    
    if (isNaN(date.getTime())) return '-';
    
    const timezone = getUserTimezone();
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...options
    };
    
    return new Intl.DateTimeFormat('es-ES', defaultOptions).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
};

/**
 * Formatea fecha y hora según la zona horaria del usuario
 * Convierte desde hora de Perú a la zona horaria configurada
 */
export const formatDateTimeInUserTimezone = (
  dateString: string | null | undefined
): string => {
  if (!dateString) return '-';
  
  try {
    // Parsear la fecha (viene en hora de Perú)
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    const timezone = getUserTimezone();
    
    const formatter = new Intl.DateTimeFormat('es-ES', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    return formatter.format(date);
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return '-';
  }
};

/**
 * Convierte una fecha almacenada en hora de Perú a la zona horaria del usuario
 * y retorna un objeto Date que puede usarse con date-fns
 * @param dateString - Fecha en formato PostgreSQL (YYYY-MM-DD HH:mm:ss) o ISO
 * @returns Date object ajustado a la zona horaria del usuario
 */
export const parsePeruDateToUserTimezone = (dateString: string): Date => {
  if (!dateString) return new Date();
  
  const userTimezone = getUserTimezone();
  
  // Si el usuario está en hora de Perú, retornar la fecha sin conversión
  if (userTimezone === 'America/Lima') {
    // Parsear directamente sin conversión
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
  }
  
  // Para otras zonas: crear la fecha interpretándola como hora de Perú
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [_, year, month, day, hour, minute, second] = match;
    // Crear como string ISO con zona horaria de Perú
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`;
    const peruDate = new Date(isoString);
    
    // Formatear en la zona del usuario
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(peruDate);
    const partsMap: Record<string, string> = {};
    parts.forEach(part => {
      if (part.type !== 'literal') {
        partsMap[part.type] = part.value;
      }
    });
    
    return new Date(
      parseInt(partsMap.year),
      parseInt(partsMap.month) - 1,
      parseInt(partsMap.day),
      parseInt(partsMap.hour),
      parseInt(partsMap.minute),
      parseInt(partsMap.second)
    );
  }
  
  return new Date(dateString);
};

/**
 * Obtiene la hora actual en la zona horaria del usuario
 */
export const getCurrentTimeInUserTimezone = (): string => {
  const timezone = getUserTimezone();
  const now = new Date();
  
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);
};

/**
 * Convierte una fecha a la zona horaria del usuario y retorna objeto Date
 */
export const convertToUserTimezone = (dateString: string): Date => {
  const date = new Date(dateString);
  const timezone = getUserTimezone();
  
  // Crear un formatter para obtener los componentes en la zona horaria del usuario
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const partsMap = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );
  
  return new Date(
    parseInt(partsMap.year),
    parseInt(partsMap.month) - 1,
    parseInt(partsMap.day),
    parseInt(partsMap.hour),
    parseInt(partsMap.minute),
    parseInt(partsMap.second)
  );
};

/**
 * Convierte una hora específica (HH:mm) de Perú a la zona horaria del usuario
 * @param timeString - Hora en formato HH:mm (ej: "09:00")
 * @returns Hora convertida en formato HH:mm
 */
export const convertTimeToUserTimezone = (timeString: string | null | undefined): string => {
  if (!timeString) return '';
  
  const userTimezone = getUserTimezone();
  
  // Si es Perú, retornar sin cambios
  if (userTimezone === 'America/Lima') {
    return timeString;
  }
  
  try {
    // Usar fecha de hoy para la conversión (solo importa la hora)
    const today = new Date();
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // Crear fecha en hora de Perú
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const hour = String(hours).padStart(2, '0');
    const minute = String(minutes).padStart(2, '0');
    
    const peruDateString = `${year}-${month}-${day}T${hour}:${minute}:00-05:00`;
    const peruDate = new Date(peruDateString);
    
    // Formatear en zona del usuario
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    return formatter.format(peruDate);
  } catch (error) {
    console.error('Error converting time:', error);
    return timeString;
  }
};

/**
 * Información de zonas horarias disponibles
 */
export const TIMEZONE_INFO = {
  'America/Bogota': { name: 'Colombia', offset: 'GMT-5' },
  'America/New_York': { name: 'Nueva York', offset: 'GMT-5/-4' },
  'America/Chicago': { name: 'Chicago', offset: 'GMT-6/-5' },
  'America/Denver': { name: 'Denver', offset: 'GMT-7/-6' },
  'America/Los_Angeles': { name: 'Los Ángeles', offset: 'GMT-8/-7' },
  'America/Mexico_City': { name: 'Ciudad de México', offset: 'GMT-6/-5' },
  'America/Argentina/Buenos_Aires': { name: 'Buenos Aires', offset: 'GMT-3' },
  'America/Santiago': { name: 'Santiago', offset: 'GMT-4/-3' },
  'America/Lima': { name: 'Lima (Perú)', offset: 'GMT-5' },
  'America/Caracas': { name: 'Caracas', offset: 'GMT-4' },
  'America/Guayaquil': { name: 'Guayaquil (Ecuador)', offset: 'GMT-5' },
  'Europe/Madrid': { name: 'Madrid', offset: 'GMT+1/+2' },
  'Europe/London': { name: 'Londres', offset: 'GMT+0/+1' },
  'UTC': { name: 'UTC', offset: 'GMT+0' },
} as const;
