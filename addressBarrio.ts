// Utility for detecting and normalizing address, barrio (neighborhood), and Google Maps locations

export const KNOWN_BARRIOS: string[] = [
  'Pocitos',
  'Pocitos Nuevo',
  'Punta Carretas',
  'Cordón',
  'Cordon',
  'Centro',
  'Ciudad Vieja',
  'Barrio Sur',
  'Palermo',
  'Parque Rodó',
  'Parque Rodo',
  'Tres Cruces',
  'La Blanqueada',
  'Parque Batlle',
  'Buceo',
  'Malvín',
  'Malvin',
  'Malvín Norte',
  'Malvin Norte',
  'Punta Gorda',
  'Carrasco',
  'Carrasco Norte',
  'Unión',
  'Union',
  'Maroñas',
  'Maronas',
  'Flor de Maroñas',
  'Flor de Maronas',
  'Aguada',
  'Reducto',
  'Bella Vista',
  'Prado',
  'Paso Molino',
  'Belvedere',
  'Sayago',
  'Peñarol',
  'Penarol',
  'Colón',
  'Colon',
  'Lezica',
  'Cerrito',
  'Cerrito de la Victoria',
  'Brazo Oriental',
  'Jacinto Vera',
  'Goes',
  'Villa Española',
  'Villa Espanola',
  'Atahualpa',
  'Capurro',
  'La Teja',
  'Cerro',
  'Casabó',
  'Casabo',
  'Paso de la Arena',
  'Manga',
  'Piedras Blancas',
  'Casavalle',
  'Borro',
  'Jardines del Hipódromo',
  'Jardines del Hipodromo',
  'Ituzaingó',
  'Ituzaingo',
  'Nuevo París',
  'Nuevo Paris',
  'Villa García',
  'Villa Garcia',
  'Toledo Chico',
  'La Comercial',
  'Figurita',
  'Lavalleja',
  'Conciliación',
  'Conciliacion',
  'Villa Muñoz',
  'Villa Munoz',
  'Barra de Carrasco',
  'Paso Carrasco',
  'Ciudad de la Costa',
  'Shangrilá',
  'Shangrila',
  'Lagomar',
  'Solymar',
  'El Pinar',
];

// Popular quick selection barrios for UI
export const POPULAR_BARRIOS = [
  'Pocitos',
  'Punta Carretas',
  'Cordón',
  'Centro',
  'Buceo',
  'Malvín',
  'Parque Rodó',
  'Tres Cruces',
  'La Blanqueada',
  'Carrasco',
  'Prado',
  'Unión',
];

/**
 * Normalizes a string removing accents and extra spaces for fuzzy matching
 */
function normalizeString(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Automatically extracts the barrio (neighborhood) from a Google address or user text,
 * or falls back to what the cashier typed if provided.
 */
export function extractBarrioAndAddress(
  rawAddress: string = '',
  rawZone: string = ''
): {
  streetAddress: string;
  barrio: string;
  fullCleanAddress: string;
  isAutoDetectedFromGoogle: boolean;
} {
  let address = (rawAddress || '').trim();
  let explicitZone = (rawZone || '').trim();

  // If cashier explicitly typed a zone and it's valid, respect it
  const hasValidExplicitZone =
    explicitZone.length > 0 &&
    !['N/A', 'NA', 'GENERAL', 'SIN ASIGNAR', 'LOCAL', 'MOSTRADOR'].includes(
      explicitZone.toUpperCase()
    );

  let detectedBarrio = '';
  let isAutoDetected = false;

  // Check if address is a Google Maps URL or contains search params
  if (address.includes('google.com/maps') || address.includes('goo.gl/maps')) {
    try {
      const urlObj = new URL(address.startsWith('http') ? address : `https://${address}`);
      const queryParam = urlObj.searchParams.get('q') || urlObj.searchParams.get('query') || '';
      if (queryParam) {
        address = decodeURIComponent(queryParam).replace(/\+/g, ' ');
      }
    } catch {
      // Keep address as is
    }
  }

  // Look for explicit prefixes like "Barrio [X]" or "B° [X]" or "Zona [X]" in address
  const barrioPrefixMatch = address.match(/(?:barrio|b°|b\.|zona)\s+([a-záéíóúÁÉÍÓÚñÑ\s]+?)(?:,|$|\.|\(|\)|\-)/i);
  if (barrioPrefixMatch && barrioPrefixMatch[1]) {
    const candidate = barrioPrefixMatch[1].trim();
    if (candidate.length >= 3) {
      detectedBarrio = candidate;
      isAutoDetected = true;
    }
  }

  // Check if any known barrio is explicitly mentioned inside the address string
  if (!detectedBarrio) {
    const normalizedAddr = normalizeString(address);
    // Sort by length descending to match "Pocitos Nuevo" before "Pocitos"
    const sortedBarrios = [...KNOWN_BARRIOS].sort((a, b) => b.length - a.length);

    for (const b of sortedBarrios) {
      const normB = normalizeString(b);
      // Word boundary regex on normalized string
      const regex = new RegExp(`\\b${normB}\\b`, 'i');
      if (regex.test(normalizedAddr)) {
        detectedBarrio = b;
        isAutoDetected = true;
        break;
      }
    }
  }

  // Google Maps comma structure fallback:
  // Usually: "Calle 1234, Barrio, 11300 Montevideo, Departamento de Montevideo, Uruguay"
  if (!detectedBarrio && address.includes(',')) {
    const parts = address.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      for (let i = 1; i < parts.length; i++) {
        const candidate = parts[i];
        const normCand = normalizeString(candidate);
        // Ignore country, department, city, postal codes
        if (
          normCand.includes('uruguay') ||
          normCand.includes('montevideo') ||
          normCand.includes('departamento') ||
          normCand.includes('canelones') ||
          /^\d{4,5}$/.test(normCand) ||
          normCand.startsWith('cp ')
        ) {
          continue;
        }

        // Clean candidate
        const cleanCand = candidate.replace(/^\d{4,5}\s*/, '').replace(/\bcp\b\s*/i, '').trim();
        if (cleanCand.length >= 3 && cleanCand.length <= 35) {
          detectedBarrio = cleanCand;
          isAutoDetected = true;
          break;
        }
      }
    }
  }

  // Final barrio resolution:
  // If the cashier provided an explicit zone, prioritize what the cashier entered,
  // UNLESS the cashier provided nothing or 'N/A', in which case we use detectedBarrio.
  let finalBarrio = hasValidExplicitZone ? explicitZone : detectedBarrio;

  // Clean street address by stripping redundant Google suffixes like ", 11300 Montevideo, Departamento de Montevideo, Uruguay"
  let cleanStreet = address
    .replace(/,\s*\d{4,5}\s*montevideo[^,]*/gi, '')
    .replace(/,\s*departamento de montevideo[^,]*/gi, '')
    .replace(/,\s*montevideo[^,]*/gi, '')
    .replace(/,\s*uruguay[^,]*/gi, '')
    .trim();

  // If the street address ends with a trailing comma, remove it
  cleanStreet = cleanStreet.replace(/,\s*$/, '').trim();

  const fullClean = [cleanStreet, finalBarrio].filter(Boolean).join(' • ');

  return {
    streetAddress: cleanStreet || address,
    barrio: finalBarrio,
    fullCleanAddress: fullClean,
    isAutoDetectedFromGoogle: isAutoDetected && !hasValidExplicitZone,
  };
}
