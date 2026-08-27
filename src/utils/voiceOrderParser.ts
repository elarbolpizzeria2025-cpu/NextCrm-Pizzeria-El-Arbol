import { MenuItem, Topping, CartItem } from '../types';
import { calculateToppingsCost, TOPPING_PRICE } from '../data/defaultMenu';

export interface ParsedVoiceOrder {
  items: CartItem[];
  destination: 'Local' | 'Envío' | 'Mesa';
  paymentMethod: string;
  cashProvided?: number;
  client: {
    name: string;
    phone: string;
    address: string;
    zone: string;
  };
  notes: string;
  rawTranscript: string;
  matchedCount: number;
}

// Convert Spanish and English spoken number words to numeric values
export function parseSpokenNumber(word: string): number | null {
  const clean = word.toLowerCase().trim();
  const map: Record<string, number> = {
    'un': 1, 'una': 1, 'uno': 1, '1': 1, 'one': 1, 'a': 1, 'an': 1, 'el': 1, 'la': 1,
    'dos': 2, '2': 2, 'two': 2, 'par': 2,
    'tres': 3, '3': 3, 'three': 3,
    'cuatro': 4, '4': 4, 'four': 4,
    'cinco': 5, '5': 5, 'five': 5,
    'seis': 6, '6': 6, 'six': 6,
    'siete': 7, '7': 7, 'seven': 7,
    'ocho': 8, '8': 8, 'eight': 8,
    'nueve': 9, '9': 9, 'nine': 9,
    'diez': 10, '10': 10, 'ten': 10,
    'doce': 12, '12': 12, 'docena': 12, 'media docena': 6,
    'medio': 0.5, 'media': 0.5, '1/2': 0.5, '0.5': 0.5, 'half': 0.5,
    'un metro y medio': 1.5, '1.5': 1.5,
  };
  return map[clean] !== undefined ? map[clean] : null;
}

// Helper to extract toppings from a specific segment text
export function extractToppingsFromSnippet(snippet: string, availableToppings: Topping[]): Topping[] {
  const foundToppings: Topping[] = [];
  const topText = snippet.toLowerCase();

  // Check specific combo toppings first
  const comboToppings = availableToppings.filter(t => t.price > 0);
  comboToppings.forEach(t => {
    const topName = t.name.toLowerCase();
    if (topText.includes(topName)) {
      foundToppings.push({ ...t });
    }
  });

  // Check individual toppings
  availableToppings.forEach(t => {
    if (foundToppings.some(ft => ft.id === t.id)) return;
    const topName = t.name.toLowerCase();
    if (
      topText.includes(topName) ||
      (topName === 'jamón' && (topText.includes('jamon') || topText.includes('jamón') || topText.includes('ham'))) ||
      (topName === 'huevo frito' && (topText.includes('huevo') || topText.includes('huevos') || topText.includes('egg'))) ||
      (topName === 'cebolla caramelizada' && (topText.includes('caramelizada') || topText.includes('cebolla caramelizada') || topText.includes('caramelized onion'))) ||
      (topName === 'champiñones' && (topText.includes('hongos') || topText.includes('champignones') || topText.includes('champiñones') || topText.includes('mushroom') || topText.includes('mushrooms') || topText.includes('champi'))) ||
      (topName === 'aceitunas' && (topText.includes('aceituna') || topText.includes('aceitunas') || topText.includes('oliva') || topText.includes('olivas') || topText.includes('olive') || topText.includes('olives'))) ||
      (topName === 'panceta' && (topText.includes('panceta') || topText.includes('bacon'))) ||
      (topName === 'rúcula' && (topText.includes('rucula') || topText.includes('rúcula') || topText.includes('arugula'))) ||
      (topName === 'roquefort' && (topText.includes('roque') || topText.includes('roquefort') || topText.includes('rockeford') || topText.includes('queso azul') || topText.includes('blue cheese'))) ||
      (topName === 'albahaca' && (topText.includes('albahaca') || topText.includes('basil'))) ||
      (topName === 'pepperoni' && (topText.includes('peperoni') || topText.includes('pepperoni') || topText.includes('calabresa'))) ||
      (topName === 'ananá' && (topText.includes('anana') || topText.includes('ananá') || topText.includes('piña') || topText.includes('pineapple'))) ||
      (topName === 'pesto' && topText.includes('pesto')) ||
      (topName === 'cebolla' && (topText.includes('cebolla') && !topText.includes('caramelizada'))) ||
      (topName === '4 quesos' && (topText.includes('cuatro quesos') || topText.includes('4 quesos') || topText.includes('4 cheeses')))
    ) {
      foundToppings.push({ ...t });
    }
  });

  return foundToppings;
}

// Detect whether a string indicates mozzarella / muza / moza
export function isMozzarellaWord(str: string): boolean {
  const s = str.toLowerCase();
  return (
    s.includes('muzzarella') ||
    s.includes('mozzarella') ||
    s.includes('mozarella') ||
    s.includes('muzarella') ||
    s.includes('mozarrella') ||
    s.includes('muzarrella') ||
    s.includes('mosarella') ||
    s.includes('musarela') ||
    s.includes('muzza') ||
    s.includes('mozza') ||
    s.includes('muza') ||
    s.includes('moza') ||
    /\b(?:musa|mucha)\b/i.test(s) ||
    (s.includes('con queso') && !s.includes('4 quesos') && !s.includes('cuatro quesos') && !s.includes('roquefort') && !s.includes('rockeford')) ||
    (s.includes('de queso') && !s.includes('4 quesos') && !s.includes('cuatro quesos') && !s.includes('roquefort') && !s.includes('rockeford'))
  );
}

// Detect whether a string indicates Fainá
export function isFainaWord(str: string): boolean {
  const s = str.toLowerCase();
  return (
    s.includes('faina') ||
    s.includes('fainá') ||
    s.includes('fayna') ||
    s.includes('fayná') ||
    s.includes('fainas') ||
    s.includes('fainás') ||
    s.includes('faena') ||
    s.includes('faína') ||
    /\b(?:final|fina|finá)\b/i.test(s)
  );
}

// Pre-process spoken transcription to normalize phonetic quirks in Uruguayan Spanish
export function cleanSpokenTranscript(raw: string): string {
  if (!raw) return '';
  let text = raw;

  text = text
    // Fainá normalization
    .replace(/\b(?:final|fayna|fayná|faena|fa in a|faína|fina|finá)\b/gi, 'fainá')
    .replace(/\b(?:fainas|fainás|faynas|faenas)\b/gi, 'fainás')
    .replace(/\b(?:faina)\b/gi, 'fainá')
    // Mozzarella variants
    .replace(/\b(?:muza|muzza|moza|musa|mucha|mosarela|muzarella|mozarella)\b/gi, 'muzzarella')
    .replace(/\bmozzarella\b/gi, 'muzzarella')
    // Sándwiches
    .replace(/\b(?:sandwiche|sandi|sandwiches|sandwich|sandwix|sanguch|sanguche|sanguches)\b/gi, 'sándwich')
    .replace(/\btostado\b/gi, 'sándwich caliente')
    .replace(/\btostados\b/gi, 'sándwiches calientes')
    // Figaza
    .replace(/\b(?:figasa|fugasa|fugaza|figazza|ficaza)\b/gi, 'figaza')
    // Pizzetas
    .replace(/\b(?:pizeta|pizetas|pizzetas|piseta|pisetas)\b/gi, 'pizzeta')
    .replace(/\b(?:rockeford|roquefor|roquefort)\b/gi, 'roquefort')
    .replace(/\b(?:calabreza|calabreces)\b/gi, 'calabresa')
    .replace(/\b(?:caprese)\b/gi, 'capresse')
    // Bebidas y Cervezas
    .replace(/\b(?:salud|zalus|saluz)\b/gi, 'salus')
    .replace(/\b(?:frute|fruté|frutte)\b/gi, 'frutté')
    .replace(/\b(?:patricio|cerveza patricio)\b/gi, 'cerveza patricia')
    .replace(/\b(?:bilsen|pilsener|pils)\b/gi, 'pilsen')
    .replace(/\b(?:silertal|silertall|zillertall)\b/gi, 'zillertal')
    .replace(/\b(?:s miller|smiller|miller)\b/gi, 'cerveza miller')
    .replace(/\b(?:stela|estela|stella artois|cerveza a)\b/gi, 'cerveza stella artois')
    .replace(/\b(?:corona 330|coronita)\b/gi, 'cerveza corona 330')
    .replace(/\b(?:coke|coca-cola)\b/gi, 'coca cola')
    .replace(/\b(?:litro y medio|1 y medio|un litro y medio|litro y media|1\.5l|1\.5 l|1,5 l|1,5 litros)\b/gi, '1.5 litros')
    .replace(/\b(?:de un litro|de litro|un litro|1 litro|1l|1 lt)\b/gi, '1 litro')
    .replace(/\b(?:600cc|600 ml|600ml|chica|personal)\b/gi, '600 ml')
    .replace(/\b(?:whiski|wisky|wiski)\b/gi, 'whisky')
    .replace(/\b(?:rose extinto|rose tinto|rosé tinto|rose o tinto)\b/gi, 'vino rosé / tinto')
    // Postres
    .replace(/\b(?:chaja|chaya|el chaja|el chajá)\b/gi, 'chajá')
    .replace(/\b(?:flanes)\b/gi, 'flan');

  return text;
}

// Clean and tokenize multi-item voice order into individual product segments
export function splitIntoItemSegments(rawText: string): string[] {
  let text = cleanSpokenTranscript(rawText)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return [];

  // Remove leading conversational fillers
  text = text.replace(/^(?:hola|buenas tardes|buenas noches|buen d[ií]a|por favor|estoy pidiendo|quiero pedir|quisiera pedir|quisiera|quiero|me das|dame|c[aá]rgame|poneme|pone|agregame|agrega|anotame|tomame el pedido|tomame|anot[aá]|pedir)\s+/i, '');

  // Protect key compound phrases from premature splitting
  const protectCompounds = (str: string): string => {
    return str
      // Promos protection
      .replace(/\b1\s+metro\s+(?:de\s+)?muzzarella\s+(?:m[aá]s|\+)\s+2\s+fain[aá]s\s+(?:y|\+)\s+(?:un|1)\s+chaj[aá]\b/gi, '__PROMO_METRO_2FAINA_CHAJA__')
      .replace(/\b1\s+metro\s+(?:de\s+)?muzzarella\s+(?:m[aá]s|\+)\s+2\s+fain[aá]s\s+(?:y|\+)\s+(?:dos|2)\s+flanes\b/gi, '__PROMO_METRO_2FAINA_2FLAN__')
      .replace(/\b(?:metro|1\s+metro)\s+(?:de\s+)?muzzarella\s+(?:m[aá]s|\+|,)?\s*(?:dos|2)\s+fain[aá]s\s*(?:y|\+|,)?\s*(?:dos|2)\s+flanes\b/gi, '__PROMO_METRO_2FAINA_2FLAN__')
      .replace(/\b(?:metro|1\s+metro)\s+(?:de\s+)?muzzarella\s+(?:m[aá]s|\+|,)?\s*(?:dos|2)\s+fain[aá]s\s*(?:y|\+|,)?\s*(?:un|1)\s+chaj[aá]\b/gi, '__PROMO_METRO_2FAINA_CHAJA__')
      .replace(/\b(?:metro|1\s+metro)\s+(?:de\s+)?muzzarella\s+(?:m[aá]s|\+|,)?\s*(?:dos|2)\s+fain[aá]s\s*(?:y|\+|,)?\s*(?:refresco\s+)?1\.5\s+litros\b/gi, '__PROMO_METRO_2FAINA_REFRESCO__')
      .replace(/\b1\s+metro\s+(?:de\s+)?muzzarella\s+(?:m[aá]s|\+)\s+2\s+fain[aá]s\b/gi, '__PROMO_METRO_2FAINA__')
      .replace(/\bmetro\s+(?:de\s+)?muzzarella\s+(?:m[aá]s|\+)\s+dos\s+fain[aá]s\b/gi, '__PROMO_METRO_2FAINA__')
      // Measurements & Names protection
      .replace(/\b1\.5\s+litros\b/gi, '__LITRO_Y_MEDIO__')
      .replace(/\b1\s+litro\b/gi, '__UN_LITRO__')
      .replace(/\b600\s+ml\b/gi, '__600_ML__')
      .replace(/\bmedio\s+metro\s+(?:de\s+)?muzzarella\b/gi, '__MEDIO_METRO_MUZZA__')
      .replace(/\bmedio\s+metro\s+(?:de\s+)?com[uú]n\b/gi, '__MEDIO_METRO_COMUN__')
      .replace(/\b1\s+metro\s+(?:de\s+)?muzzarella\b/gi, '__UN_METRO_MUZZA__')
      .replace(/\b1\s+metro\s+(?:de\s+)?com[uú]n\b/gi, '__UN_METRO_COMUN__')
      .replace(/\bporci[oó]n\s+(?:de\s+)?muzzarella\b/gi, '__PORCION_MUZZA__')
      .replace(/\bporci[oó]n\s+(?:de\s+)?com[uú]n\b/gi, '__PORCION_COMUN__')
      .replace(/\bfain[aá]\s+de\s+la\s+casa\s+jpm\b/gi, '__FAINA_JPM__')
      .replace(/\bfain[aá]\s+ddl\b/gi, '__FAINA_DDL__')
      .replace(/\bfain[aá]\s+con\s+muzzarella\b/gi, '__FAINA_MUZZA__')
      .replace(/\bfain[aá]\s+com[uú]n\b/gi, '__FAINA_COMUN__')
      .replace(/\bfigaza\s+con\s+muzzarella\b/gi, '__FIGAZA_MUZZA__')
      .replace(/\bfigaza\s+com[uú]n\b/gi, '__FIGAZA_COMUN__')
      .replace(/\bs[aá]ndwich\s+caliente\s+con\s+muzzarella\b/gi, '__SANDWICH_MUZZA__')
      .replace(/\bs[aá]ndwich\s+caliente\b/gi, '__SANDWICH_CALIENTE__')
      .replace(/\bs[aá]ndwich\s+napolitano\b/gi, '__SANDWICH_NAPOLITANO__')
      .replace(/\bpizzeta\s+muzzarella\b/gi, '__PIZZETA_MUZZA__')
      .replace(/\bpizzeta\s+napolitana\b/gi, '__PIZZETA_NAPO__')
      .replace(/\bpizzeta\s+calabresa\b/gi, '__PIZZETA_CALABRESA__')
      .replace(/\bpizzeta\s+4\s+quesos\b/gi, '__PIZZETA_4QUESOS__')
      .replace(/\bpizzeta\s+hawaiana\b/gi, '__PIZZETA_HAWAI__')
      .replace(/\bpizzeta\s+americana\b/gi, '__PIZZETA_AMER__')
      .replace(/\bpizzeta\s+roquefort\s+y\s+cebolla\b/gi, '__PIZZETA_ROQUE__')
      .replace(/\bpizzeta\s+roquefort\b/gi, '__PIZZETA_ROQUE__')
      .replace(/\bpizzeta\s+r[uú]cula\s+y\s+tomate\b/gi, '__PIZZETA_RUCULA__')
      .replace(/\bpizzeta\s+jam[oó]n\s+y\s+champi[nñ]ones\b/gi, '__PIZZETA_CHAMPI__')
      .replace(/\bpizzeta\s+jam[oó]n\s+y\s+aceitunas\b/gi, '__PIZZETA_ACEIT__')
      .replace(/\bpizzeta\s+capresse\b/gi, '__PIZZETA_CAPRESSE__')
      .replace(/\bpizzeta\s+caprese\b/gi, '__PIZZETA_CAPRESSE__')
      .replace(/\bpostre\s+chaj[aá]\b/gi, '__POSTRE_CHAJA__')
      .replace(/\bflan\s+casero\b/gi, '__FLAN_CASERO__')
      .replace(/\bsalus\s+frutt[eé]\s+600\s+ml\b/gi, '__SALUS_FRUTTE_600__')
      .replace(/\bsalus\s+frutt[eé]\s+1\.5\s+litros\b/gi, '__SALUS_FRUTTE_15__')
      .replace(/\bagua\s+salus\s+600\s+ml\b/gi, '__AGUA_SALUS_600__')
      .replace(/\bagua\s+salus\s+1\.5\s+litros\b/gi, '__AGUA_SALUS_15__')
      .replace(/\bcerveza\s+patricia\s+1\s+litro\b/gi, '__CERVEZA_PATRICIA__')
      .replace(/\bcerveza\s+pilsen\s+1\s+litro\b/gi, '__CERVEZA_PILSEN__')
      .replace(/\bcerveza\s+zillertal\s+1\s+litro\b/gi, '__CERVEZA_ZILLERTAL__')
      .replace(/\bcerveza\s+miller\b/gi, '__CERVEZA_MILLER__')
      .replace(/\bcerveza\s+stella\s+artois\b/gi, '__CERVEZA_STELLA__')
      .replace(/\bcerveza\s+corona\s+330\b/gi, '__CERVEZA_CORONA__')
      .replace(/\bcerveza\s+artesanal\b/gi, '__CERVEZA_ARTESANAL__')
      .replace(/\bcosto\s+de\s+env[ií]o\b/gi, '__COSTO_ENVIO__')
      .replace(/\bcosto\s+extra\s+fijo\b/gi, '__COSTO_EXTRA_FIJO__')
      .replace(/\bvino\s+ros[eé]\s*\/\s*tinto\b/gi, '__VINO_ROSE_TINTO__');
  };

  const unprotectCompounds = (str: string): string => {
    return str
      .replace(/__PROMO_METRO_2FAINA_CHAJA__/g, 'promo 1 metro muzzarella + 2 fainás + 1 chajá')
      .replace(/__PROMO_METRO_2FAINA_2FLAN__/g, 'promo 1 metro muzzarella + 2 fainás + 2 flanes')
      .replace(/__PROMO_METRO_2FAINA_REFRESCO__/g, 'promo 1 metro muzzarella + 2 fainás + refresco 1.5l')
      .replace(/__PROMO_METRO_2FAINA__/g, 'promo 1 metro muzzarella + 2 fainás')
      .replace(/__LITRO_Y_MEDIO__/g, 'refresco 1.5 litros')
      .replace(/__UN_LITRO__/g, 'refresco 1 litro')
      .replace(/__600_ML__/g, 'refresco 600 ml')
      .replace(/__MEDIO_METRO_MUZZA__/g, 'medio metro de muzzarella')
      .replace(/__MEDIO_METRO_COMUN__/g, 'medio metro común')
      .replace(/__UN_METRO_MUZZA__/g, '1 metro de muzzarella')
      .replace(/__UN_METRO_COMUN__/g, '1 metro común')
      .replace(/__PORCION_MUZZA__/g, 'porción de muzzarella')
      .replace(/__PORCION_COMUN__/g, 'porción común')
      .replace(/__FAINA_JPM__/g, 'fainá de la casa jpm')
      .replace(/__FAINA_DDL__/g, 'fainá ddl')
      .replace(/__FAINA_MUZZA__/g, 'fainá con muzzarella')
      .replace(/__FAINA_COMUN__/g, 'fainá común')
      .replace(/__FIGAZA_MUZZA__/g, 'figaza con muzzarella')
      .replace(/__FIGAZA_COMUN__/g, 'figaza común')
      .replace(/__SANDWICH_MUZZA__/g, 'sándwich caliente con muzzarella')
      .replace(/__SANDWICH_CALIENTE__/g, 'sándwich caliente')
      .replace(/__SANDWICH_NAPOLITANO__/g, 'sándwich napolitano')
      .replace(/__PIZZETA_MUZZA__/g, 'pizzeta muzzarella')
      .replace(/__PIZZETA_NAPO__/g, 'pizzeta napolitana')
      .replace(/__PIZZETA_CALABRESA__/g, 'pizzeta calabresa')
      .replace(/__PIZZETA_4QUESOS__/g, 'pizzeta 4 quesos')
      .replace(/__PIZZETA_HAWAI__/g, 'pizzeta hawaiana')
      .replace(/__PIZZETA_AMER__/g, 'pizzeta americana')
      .replace(/__PIZZETA_ROQUE__/g, 'pizzeta roquefort y cebolla')
      .replace(/__PIZZETA_RUCULA__/g, 'pizzeta rúcula y tomate')
      .replace(/__PIZZETA_CHAMPI__/g, 'pizzeta jamón y champiñones')
      .replace(/__PIZZETA_ACEIT__/g, 'pizzeta jamón y aceitunas')
      .replace(/__PIZZETA_CAPRESSE__/g, 'pizzeta capresse')
      .replace(/__POSTRE_CHAJA__/g, 'postre chajá')
      .replace(/__FLAN_CASERO__/g, 'flan casero')
      .replace(/__SALUS_FRUTTE_600__/g, 'salus frutté 600 ml')
      .replace(/__SALUS_FRUTTE_15__/g, 'salus frutté 1.5 l')
      .replace(/__AGUA_SALUS_600__/g, 'agua salus 600ml')
      .replace(/__AGUA_SALUS_15__/g, 'agua salus 1.5l')
      .replace(/__CERVEZA_PATRICIA__/g, 'cerveza patricia 1l')
      .replace(/__CERVEZA_PILSEN__/g, 'cerveza pilsen 1l')
      .replace(/__CERVEZA_ZILLERTAL__/g, 'cerveza zillertal 1l')
      .replace(/__CERVEZA_MILLER__/g, 'cerveza miller 1l')
      .replace(/__CERVEZA_STELLA__/g, 'cerveza stella artois 1l')
      .replace(/__CERVEZA_CORONA__/g, 'cerveza corona 330')
      .replace(/__CERVEZA_ARTESANAL__/g, 'cerveza artesanal')
      .replace(/__COSTO_ENVIO__/g, 'costo de envío')
      .replace(/__COSTO_EXTRA_FIJO__/g, 'costo extra fijo')
      .replace(/__VINO_ROSE_TINTO__/g, 'vino rosé / tinto');
  };

  const protectedText = protectCompounds(text);

  // 1. First split by lines, bullets, numbers
  const step1 = protectedText.split(/\r?\n|[-•*]\s+|\b(?:\d+[\.\)]\s+)/);

  // 2. Further split by strong item conjunctions
  const step2: string[] = [];
  step1.forEach(chunk => {
    const pieces = chunk.split(
      /\s*(?:,\s*(?!(?:con|with|sin|without|de|of)\b)|\b(?:y\s+(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+|otro|otra|medio))\b|\b(?:e\s+(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+))\b|\b(?:m[aá]s\s+(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+|otro|otra))\b|\b(?:tambi[eé]n\s+(?:un|una|uno|dos|tres|cuatro|cinco|\d+|otro|otra))\b|\b(?:adem[aá]s\s+(?:un|una|uno|dos|tres|\d+))\b|\b(?:c[aá]rgame|agregame|poneme|sumale|sumame)\b)\s*/i
    );
    pieces.forEach(p => {
      const pt = p.trim();
      if (pt) step2.push(pt);
    });
  });

  // 3. Unprotect and return segments
  const finalSegments: string[] = [];
  step2.forEach(segment => {
    const unprot = unprotectCompounds(segment).trim();
    if (unprot) finalSegments.push(unprot);
  });

  return finalSegments;
}

// Client-side instant heuristic parser for reliable offline/low-latency parsing
export function parseVoiceOrderHeuristic(
  transcript: string,
  menu: Record<string, MenuItem[]>,
  availableToppings: Topping[]
): ParsedVoiceOrder {
  const text = cleanSpokenTranscript(transcript).toLowerCase();

  // 1. Detect Destination / Service Type
  let destination: 'Local' | 'Envío' | 'Mesa' = 'Local';
  if (
    text.includes('delivery') ||
    text.includes('envio') ||
    text.includes('envío') ||
    text.includes('domicilio') ||
    text.includes('mandar') ||
    text.includes('para llevar a casa') ||
    text.includes('a entregar')
  ) {
    destination = 'Envío';
  } else if (
    text.includes('mesa') ||
    text.includes('para comer aca') ||
    text.includes('para comer acá') ||
    text.includes('salon') ||
    text.includes('salón')
  ) {
    destination = 'Mesa';
  } else if (
    text.includes('mostrador') ||
    text.includes('para llevar') ||
    text.includes('retiro') ||
    text.includes('pasar a buscar') ||
    text.includes('local')
  ) {
    destination = 'Local';
  }

  // 2. Detect Payment Method
  let paymentMethod = 'Efectivo';
  if (text.includes('debito') || text.includes('débito')) {
    paymentMethod = 'Débito';
  } else if (text.includes('tarjeta') || text.includes('credito') || text.includes('crédito') || text.includes('pos')) {
    paymentMethod = 'Tarjeta';
  } else if (text.includes('transferencia') || text.includes('transfer') || text.includes('prex') || text.includes('banco') || text.includes('oca blue')) {
    paymentMethod = 'Transferencia';
  } else if (text.includes('mercado pago') || text.includes('mercadopago') || text.includes('qr')) {
    paymentMethod = 'Mercado Pago';
  } else if (text.includes('efectivo') || text.includes('cash') || text.includes('pesos')) {
    paymentMethod = 'Efectivo';
  }

  // 3. Detect Cash provided
  let cashProvided: number | undefined;
  const cashMatch = text.match(/(?:paga con|cambio de|pago con|billete de|con billete de)\s*(\$?\s*\d+[\d.,]*)/i);
  if (cashMatch) {
    const rawNum = cashMatch[1].replace('$', '').replace('.', '').replace(',', '').trim();
    const num = parseFloat(rawNum);
    if (!isNaN(num) && num > 0) cashProvided = num;
  }
  if (!cashProvided) {
    if (text.includes('dos mil') || text.includes('2 mil')) cashProvided = 2000;
    else if (text.includes('mil pesos') || text.includes('un mil') || text.includes('1 mil')) cashProvided = 1000;
    else if (text.includes('tres mil') || text.includes('3 mil')) cashProvided = 3000;
    else if (text.includes('cinco mil') || text.includes('5 mil')) cashProvided = 5000;
    else if (text.includes('quinientos')) cashProvided = 500;
  }

  // 4. Detect Customer details
  const client = {
    name: '',
    phone: '',
    address: '',
    zone: ''
  };

  const nameMatch = text.match(/(?:a nombre de|cliente|nombre|para)\s+([a-záéíóúñ\s]+?)(?:,|\.|\s+tel[eé]fono|\s+celular|\s+direcci[oó]n|\s+calle|\s+paga|\s+destino|\s+delivery|$)/i);
  if (nameMatch && !['llevar', 'comer', 'mesa', 'mostrador', 'entregar', 'enviar'].includes(nameMatch[1].trim().toLowerCase())) {
    client.name = nameMatch[1].trim();
  }

  const phoneMatch = text.match(/(?:tel[eé]fono|celular|cel|tel)?\s*(09\d{1}\s*\d{3}\s*\d{3}|\d{8,9})/);
  if (phoneMatch) {
    client.phone = phoneMatch[1].replace(/\s+/g, '');
  }

  const addrMatch = text.match(/(?:direcci[oó]n|calle|en|para entregar en)\s+([a-záéíóúñ0-9\s]+?)(?:,|\.|\s+paga|\s+destino|\s+tel|$)/i);
  if (addrMatch && !['mostrador', 'local', 'mesa', 'delivery', 'efectivo', 'tarjeta'].includes(addrMatch[1].trim().toLowerCase())) {
    client.address = addrMatch[1].trim();
  }

  // 5. Build Complete Menu Items Dictionary
  const allMenuItems: MenuItem[] = [];
  Object.values(menu).forEach(catList => {
    if (Array.isArray(catList)) {
      allMenuItems.push(...catList);
    }
  });

  const parsedItems: CartItem[] = [];

  const extractQuantity = (snippet: string): number => {
    const s = snippet.trim();
    const directMatch = s.match(/^(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+)\b/i);
    if (directMatch) {
      const val = parseSpokenNumber(directMatch[0]);
      if (val && val >= 1) return Math.floor(val);
    }

    if (s.includes('dos ') || s.includes('2 ') || s.includes('dos de') || s.includes('2 de') || s.includes('par de')) return 2;
    if (s.includes('tres ') || s.includes('3 ') || s.includes('tres de') || s.includes('3 de')) return 3;
    if (s.includes('cuatro ') || s.includes('4 ')) return 4;
    if (s.includes('cinco ') || s.includes('5 ')) return 5;
    if (s.includes('seis ') || s.includes('6 ')) return 6;
    if (s.includes('siete ') || s.includes('7 ')) return 7;
    if (s.includes('ocho ') || s.includes('8 ')) return 8;
    if (s.includes('nueve ') || s.includes('9 ')) return 9;
    if (s.includes('diez ') || s.includes('10 ')) return 10;
    if (s.includes('docena')) return 12;

    return 1;
  };

  const segments = splitIntoItemSegments(text);

  segments.forEach(rawSegment => {
    const segment = rawSegment.trim();
    if (!segment) return;

    let quantity = extractQuantity(segment);
    let matchedItem: MenuItem | null = null;
    const isMuzza = isMozzarellaWord(segment);

    // ==========================================
    // 1. PROMOS EXACT DETECTION
    // ==========================================
    if (
      segment.includes('promo 1 metro muzzarella + 2 fainás + 1 chajá') ||
      (segment.includes('metro') && isMuzza && isFainaWord(segment) && (segment.includes('chaja') || segment.includes('chajá')))
    ) {
      matchedItem = allMenuItems.find(i => i.id === 'pr2' || i.name.includes('1 Chajá')) || null;
    } else if (
      segment.includes('promo 1 metro muzzarella + 2 fainás + 2 flanes') ||
      (segment.includes('metro') && isMuzza && isFainaWord(segment) && (segment.includes('flan') || segment.includes('flanes')))
    ) {
      matchedItem = allMenuItems.find(i => i.id === 'pr3' || i.name.includes('2 Flanes')) || null;
    } else if (
      segment.includes('promo 1 metro muzzarella + 2 fainás + refresco 1.5l') ||
      (segment.includes('metro') && isMuzza && isFainaWord(segment) && (segment.includes('refresco') || segment.includes('1.5') || segment.includes('coca')))
    ) {
      matchedItem = allMenuItems.find(i => i.id === 'pr4' || i.name.includes('Refresco')) || null;
    } else if (
      segment.includes('promo 1 metro muzzarella + 2 fainás') ||
      (segment.includes('metro') && isMuzza && isFainaWord(segment)) ||
      (segment.includes('promo') && segment.includes('fainá'))
    ) {
      matchedItem = allMenuItems.find(i => i.id === 'pr1') || null;
    }

    // ==========================================
    // 2. FAINÁ (Highest Priority)
    // Matches: "faina común", "faina con mozzarella", "faina de la casa JPM", "faina DDL"
    // ==========================================
    else if (isFainaWord(segment)) {
      if (segment.includes('jpm') || segment.includes('casa') || segment.includes('pesto') || segment.includes('especial')) {
        matchedItem = allMenuItems.find(i => i.id === 'f3' || i.name.toLowerCase().includes('jpm')) || null;
      } else if (segment.includes('dulce') || segment.includes('ddl') || segment.includes('leche')) {
        matchedItem = allMenuItems.find(i => i.id === 'f4' || i.name.toLowerCase().includes('ddl')) || null;
      } else if (isMuzza || segment.includes('queso') || segment.includes('muzza') || segment.includes('mozza')) {
        matchedItem = allMenuItems.find(i => i.id === 'f2' || i.name.toLowerCase().includes('con muzzarella') || i.name.toLowerCase().includes('con mozzarella')) || null;
      } else {
        matchedItem = allMenuItems.find(i => i.id === 'f1' || i.name.toLowerCase().includes('fainá común') || i.name.toLowerCase().includes('faina comun')) || null;
      }
    }

    // ==========================================
    // 3. FIGAZAS (Común o con Muzzarella)
    // Matches: "figaza común", "figaza con mozzarella"
    // ==========================================
    else if (segment.includes('figaza') || segment.includes('fugazza')) {
      if (isMuzza || segment.includes('con queso') || segment.includes('queso')) {
        matchedItem = allMenuItems.find(i => i.id === 'fg2' || i.name.toLowerCase().includes('figaza con muzzarella')) || null;
      } else {
        matchedItem = allMenuItems.find(i => i.id === 'fg1' || i.name.toLowerCase().includes('figaza común') || i.name.toLowerCase().includes('figaza comun')) || null;
      }
    }

    // ==========================================
    // 4. SÁNDWICHES
    // Matches: "sándwich caliente", "sándwich caliente con mozzarella", "sándwich napolitano"
    // ==========================================
    else if (
      segment.includes('sandwich') ||
      segment.includes('sándwich') ||
      segment.includes('sandwiches') ||
      segment.includes('tostado') ||
      segment.includes('tostados')
    ) {
      if (segment.includes('napolitano') || segment.includes('napolitana')) {
        matchedItem = allMenuItems.find(i => i.id === 's3' || i.name.toLowerCase().includes('napolitano')) || null;
      } else if (isMuzza || segment.includes('con queso') || segment.includes('queso')) {
        matchedItem = allMenuItems.find(i => i.id === 's2' || (i.name.toLowerCase().includes('sándwich caliente') && i.name.toLowerCase().includes('muzzarella'))) || null;
      } else {
        matchedItem = allMenuItems.find(i => i.id === 's1' || i.name.toLowerCase() === 'sándwich caliente' || i.name.toLowerCase() === 'sandwich caliente') || null;
      }
    }

    // ==========================================
    // 5. PIZZETAS
    // Matches: Pizzeta mozzarella, napolitana, calabreza, 4 quesos, hawaiana, americana, rockeford, rúcula y tomate, jamón y champiñones, jamón y aceitunas, caprese
    // ==========================================
    else if (segment.includes('pizzeta') || segment.includes('pizzetas')) {
      if (segment.includes('napolitana')) matchedItem = allMenuItems.find(i => i.id === 'pz2') || null;
      else if (segment.includes('calabresa') || segment.includes('calabreza') || segment.includes('pepperoni')) matchedItem = allMenuItems.find(i => i.id === 'pz3') || null;
      else if (segment.includes('4 quesos') || segment.includes('cuatro quesos')) matchedItem = allMenuItems.find(i => i.id === 'pz4') || null;
      else if (segment.includes('hawaiana') || segment.includes('anana') || segment.includes('ananá') || segment.includes('piña')) matchedItem = allMenuItems.find(i => i.id === 'pz5') || null;
      else if (segment.includes('americana')) matchedItem = allMenuItems.find(i => i.id === 'pz6') || null;
      else if (segment.includes('roquefort') || segment.includes('rockeford') || segment.includes('cebolla')) matchedItem = allMenuItems.find(i => i.id === 'pz7') || null;
      else if (segment.includes('rucula') || segment.includes('rúcula')) matchedItem = allMenuItems.find(i => i.id === 'pz8') || null;
      else if (segment.includes('champi') || segment.includes('hongo')) matchedItem = allMenuItems.find(i => i.id === 'pz9') || null;
      else if (segment.includes('aceituna')) matchedItem = allMenuItems.find(i => i.id === 'pz10') || null;
      else if (segment.includes('capresse') || segment.includes('caprese')) matchedItem = allMenuItems.find(i => i.id === 'pz11') || null;
      else matchedItem = allMenuItems.find(i => i.id === 'pz1' || i.name.toLowerCase().includes('pizzeta muzzarella')) || null;
    }

    // ==========================================
    // 6. POSTRES (Chajá, Flan)
    // Matches: "chaja", "flan", "postre chaja"
    // ==========================================
    else if (segment.includes('chaja') || segment.includes('chajá') || segment.includes('flan')) {
      if (segment.includes('chaja') || segment.includes('chajá')) {
        matchedItem = allMenuItems.find(i => i.id === 'pt1' || i.name.toLowerCase().includes('chajá') || i.name.toLowerCase().includes('chaja')) || null;
      } else if (segment.includes('flan')) {
        matchedItem = allMenuItems.find(i => i.id === 'pt2' || i.name.toLowerCase().includes('flan')) || null;
      }
    }

    // ==========================================
    // 7. BEBIDAS, CERVEZAS, AGUAS, WHISKY, VINOS
    // ==========================================
    else if (
      segment.includes('patricia') ||
      segment.includes('pilsen') ||
      segment.includes('zillertal') ||
      segment.includes('miller') ||
      segment.includes('stella') ||
      segment.includes('corona') ||
      segment.includes('artesanal') ||
      segment.includes('salus') ||
      segment.includes('frutté') ||
      segment.includes('frutte') ||
      segment.includes('whisky') ||
      segment.includes('vino') ||
      segment.includes('rosé') ||
      segment.includes('rose') ||
      segment.includes('tinto') ||
      segment.includes('refresco') ||
      segment.includes('gaseosa') ||
      segment.includes('coca') ||
      segment.includes('sprite') ||
      segment.includes('fanta') ||
      segment.includes('pepsi') ||
      segment.includes('agua') ||
      segment.includes('cerveza')
    ) {
      if (segment.includes('patricia')) {
        matchedItem = allMenuItems.find(i => i.id === 'b4' || i.name.toLowerCase().includes('patricia')) || null;
      } else if (segment.includes('pilsen')) {
        matchedItem = allMenuItems.find(i => i.id === 'b5' || i.name.toLowerCase().includes('pilsen')) || null;
      } else if (segment.includes('zillertal')) {
        matchedItem = allMenuItems.find(i => i.id === 'b6' || i.name.toLowerCase().includes('zillertal')) || null;
      } else if (segment.includes('miller')) {
        matchedItem = allMenuItems.find(i => i.id === 'b7_mil' || i.name.toLowerCase().includes('miller')) || null;
      } else if (segment.includes('stella')) {
        matchedItem = allMenuItems.find(i => i.id === 'b7_ste' || i.name.toLowerCase().includes('stella')) || null;
      } else if (segment.includes('corona')) {
        matchedItem = allMenuItems.find(i => i.id === 'b7_cor' || i.name.toLowerCase().includes('corona')) || null;
      } else if (segment.includes('artesanal')) {
        matchedItem = allMenuItems.find(i => i.id === 'b7_art' || i.name.toLowerCase().includes('artesanal')) || null;
      } else if (segment.includes('frutté') || segment.includes('frutte')) {
        if (segment.includes('1.5') || segment.includes('litro y medio')) {
          matchedItem = allMenuItems.find(i => i.id === 'b11_sf15' || i.name.toLowerCase().includes('frutté 1.5')) || null;
        } else {
          matchedItem = allMenuItems.find(i => i.id === 'b10_sf6' || i.name.toLowerCase().includes('frutté 600')) || null;
        }
      } else if (segment.includes('salus') || segment.includes('agua')) {
        if (segment.includes('1.5') || segment.includes('litro y medio')) {
          matchedItem = allMenuItems.find(i => i.id === 'b9' || i.name.toLowerCase().includes('salus 1.5')) || null;
        } else {
          matchedItem = allMenuItems.find(i => i.id === 'b8' || i.name.toLowerCase().includes('salus 600')) || null;
        }
      } else if (segment.includes('whisky')) {
        matchedItem = allMenuItems.find(i => i.id === 'b12_w' || i.name.toLowerCase().includes('whisky')) || null;
      } else if (segment.includes('vino') || segment.includes('rosé') || segment.includes('rose') || segment.includes('tinto')) {
        matchedItem = allMenuItems.find(i => i.id === 'b13_v' || i.name.toLowerCase().includes('vino')) || null;
      } else if (segment.includes('cerveza')) {
        matchedItem = allMenuItems.find(i => i.id === 'b4' || i.name.toLowerCase().includes('patricia')) || null;
      } else {
        // Refrescos (Coca, Sprite, Fanta, Schweppes, etc.)
        const isZero = segment.includes('zero') || segment.includes('sin azucar') || segment.includes('sin azúcar') || segment.includes('light') || segment.includes('cero');
        const is600 = segment.includes('600') || segment.includes('chica') || segment.includes('individual');
        const isFanta = segment.includes('fanta') || segment.includes('naranja');
        const isPomelo = segment.includes('pomelo') || segment.includes('schweppes pomelo');
        const isTonica = segment.includes('tonica') || segment.includes('tónica') || segment.includes('schweppes tonica') || segment.includes('schweppes tónica');
        const isSprite = segment.includes('sprite') || segment.includes('esprite');
        const isCoca = segment.includes('coca') || segment.includes('cola');

        if (isFanta) {
          matchedItem = allMenuItems.find(i => i.id === 'b_fanta_15' || i.name.toLowerCase().includes('fanta')) || null;
        } else if (isPomelo) {
          matchedItem = allMenuItems.find(i => i.id === 'b_schweppes_pomelo_15' || i.name.toLowerCase().includes('schweppes pomelo') || i.name.toLowerCase().includes('pomelo')) || null;
        } else if (isTonica) {
          matchedItem = allMenuItems.find(i => i.id === 'b_schweppes_tonica_15' || i.name.toLowerCase().includes('schweppes tónica') || i.name.toLowerCase().includes('tonica')) || null;
        } else if (isSprite) {
          if (is600) {
            matchedItem = isZero
              ? (allMenuItems.find(i => i.id === 'b_sprite_600_zero' || (i.name.toLowerCase().includes('sprite') && i.name.toLowerCase().includes('600') && i.name.toLowerCase().includes('zero'))) || null)
              : (allMenuItems.find(i => i.id === 'b_sprite_600' || (i.name.toLowerCase().includes('sprite') && i.name.toLowerCase().includes('600'))) || null);
          } else {
            matchedItem = allMenuItems.find(i => i.id === 'b_sprite_15' || (i.name.toLowerCase().includes('sprite') && i.name.toLowerCase().includes('1.5'))) || null;
          }
        } else if (isCoca) {
          if (is600) {
            matchedItem = isZero
              ? (allMenuItems.find(i => i.id === 'b_coca_600_zero' || (i.name.toLowerCase().includes('coca') && i.name.toLowerCase().includes('600') && i.name.toLowerCase().includes('zero'))) || null)
              : (allMenuItems.find(i => i.id === 'b_coca_600' || (i.name.toLowerCase().includes('coca') && i.name.toLowerCase().includes('600'))) || null);
          } else {
            matchedItem = isZero
              ? (allMenuItems.find(i => i.id === 'b_coca_15_zero' || (i.name.toLowerCase().includes('coca') && i.name.toLowerCase().includes('1.5') && i.name.toLowerCase().includes('zero'))) || null)
              : (allMenuItems.find(i => i.id === 'b_coca_15' || (i.name.toLowerCase().includes('coca') && i.name.toLowerCase().includes('1.5'))) || null);
          }
        } else {
          // General Refresco
          if (is600) {
            matchedItem = allMenuItems.find(i => i.name.toLowerCase().includes('600')) || null;
          } else {
            matchedItem = allMenuItems.find(i => i.name.toLowerCase().includes('1.5')) || null;
          }
        }
      }
    }

    // ==========================================
    // 8. METROS & MEDIOS METROS DE PIZZA
    // Matches: "medio metro de mozzarella", "medio metro común", "1 metro de mozzarella", "1 metro común"
    // ==========================================
    else if (segment.includes('metro') || segment.includes('metros')) {
      const isHalf = segment.includes('medio') || segment.includes('media') || segment.includes('1/2');
      const isPlain = segment.includes('común') || segment.includes('comun') || segment.includes('sin queso') || segment.includes('sin muza');

      if (isHalf) {
        matchedItem = isPlain
          ? (allMenuItems.find(i => i.id === 'p2') || null)
          : (allMenuItems.find(i => i.id === 'p5') || null);
      } else {
        matchedItem = isPlain
          ? (allMenuItems.find(i => i.id === 'p1') || null)
          : (allMenuItems.find(i => i.id === 'p4') || null);
      }
    }

    // ==========================================
    // 9. EXTRAS
    // Matches: "costo de envío", "costo extra fijo"
    // ==========================================
    else if (segment.includes('envío') || segment.includes('costo de envío') || segment.includes('extra fijo')) {
      if (segment.includes('extra fijo')) {
        matchedItem = allMenuItems.find(i => i.id === 'ext2') || null;
      } else {
        matchedItem = allMenuItems.find(i => i.id === 'ext1') || null;
      }
    }

    // ==========================================
    // 10. PIZZAS PORCIÓN
    // Matches: "porción mozzarella", "porción común", "1 pizza de muzzarella", "1 pizza común"
    // ==========================================
    else if (
      segment.includes('pizza') ||
      segment.includes('porcion') ||
      segment.includes('porción') ||
      isMuzza ||
      segment.includes('comun') ||
      segment.includes('común')
    ) {
      const isPlain = (segment.includes('comun') || segment.includes('común') || segment.includes('sin queso') || segment.includes('sin muza')) && !isMuzza;
      matchedItem = isPlain
        ? (allMenuItems.find(i => i.id === 'p3') || null)
        : (allMenuItems.find(i => i.id === 'p6') || null);
    }

    // Dynamic search across all menu names
    if (!matchedItem) {
      for (const item of allMenuItems) {
        const iName = item.name.toLowerCase();
        if (segment.includes(iName)) {
          matchedItem = item;
          break;
        }
      }
    }

    if (matchedItem) {
      const selectedToppings = extractToppingsFromSnippet(segment, availableToppings);
      const toppingsCost = calculateToppingsCost(matchedItem, selectedToppings);
      const finalPrice = matchedItem.price + (matchedItem.isPortion ? toppingsCost : toppingsCost / quantity);

      parsedItems.push({
        ...matchedItem,
        cartId: `${matchedItem.id}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        selectedToppings,
        finalPrice,
        quantity: Math.max(1, quantity)
      });
    }
  });

  const notesMatches: string[] = [];

  // 1. Explicit spoken note detection (e.g. "nota refresco 1.5 coca cola", "nota: bien tostado", "notas sin orégano")
  const explicitNoteMatch = transcript.match(/(?:nota|notas|note|observaci[oó]n|observaciones|comentario|comentarios)[:\s]+(.+)$/i);
  if (explicitNoteMatch && explicitNoteMatch[1]) {
    const extracted = explicitNoteMatch[1].trim();
    if (extracted) notesMatches.push(extracted);
  }

  // 2. Keyword-based quick notes detection
  if (text.includes('crocante') || text.includes('bien tostado') || text.includes('bien cocido') || text.includes('bien dorado')) {
    if (!notesMatches.some(n => n.toLowerCase().includes('dorad') || n.toLowerCase().includes('tostad') || n.toLowerCase().includes('crocante'))) {
      notesMatches.push('Bien dorado / crocante');
    }
  }
  if (text.includes('sin oregano') || text.includes('sin orégano')) {
    if (!notesMatches.some(n => n.toLowerCase().includes('orégano') || n.toLowerCase().includes('oregano'))) {
      notesMatches.push('Sin orégano');
    }
  }
  if (text.includes('sin cebolla')) {
    if (!notesMatches.some(n => n.toLowerCase().includes('cebolla'))) {
      notesMatches.push('Sin cebolla');
    }
  }
  if (text.includes('salsa aparte')) {
    if (!notesMatches.some(n => n.toLowerCase().includes('salsa'))) {
      notesMatches.push('Salsa aparte');
    }
  }
  if (text.includes('bien caliente')) {
    if (!notesMatches.some(n => n.toLowerCase().includes('caliente'))) {
      notesMatches.push('Bien caliente');
    }
  }
  if (text.includes('urgente') || text.includes('apuro')) {
    if (!notesMatches.some(n => n.toLowerCase().includes('urgente') || n.toLowerCase().includes('apuro'))) {
      notesMatches.push('Urgente / Apuro');
    }
  }

  return {
    items: parsedItems,
    destination,
    paymentMethod,
    cashProvided,
    client,
    notes: notesMatches.join(' • '),
    rawTranscript: transcript,
    matchedCount: parsedItems.length
  };
}

// Full Intelligent Voice Parser with Server Gemini integration and instant client fallback
export async function parseVoiceOrderWithAI(
  transcript: string,
  menu: Record<string, MenuItem[]>,
  availableToppings: Topping[]
): Promise<ParsedVoiceOrder> {
  const fallbackResult = parseVoiceOrderHeuristic(transcript, menu, availableToppings);

  try {
    const res = await fetch('/api/parse-voice-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        menu,
        toppings: availableToppings
      })
    });

    if (!res.ok) {
      return fallbackResult;
    }

    const json = await res.json();
    if (json.success && json.data && Array.isArray(json.data.items) && json.data.items.length > 0) {
      const aiData = json.data;
      const allMenuItems: MenuItem[] = [];
      Object.values(menu).forEach(list => { if (Array.isArray(list)) allMenuItems.push(...list); });

      const aiItems: CartItem[] = aiData.items.map((it: any) => {
        const originalItem = allMenuItems.find(m => m.id === it.id || m.name.toLowerCase() === (it.name || '').toLowerCase()) || {
          id: it.id || `custom-${Date.now()}`,
          name: it.name || 'Producto',
          price: it.price || 0,
          isPortion: it.isPortion,
          isMeter: it.isMeter,
          hasToppings: it.hasToppings
        };

        const toppings: Topping[] = Array.isArray(it.selectedToppings) ? it.selectedToppings : [];
        const toppingsCost = calculateToppingsCost(originalItem, toppings);
        const itemQty = it.quantity && it.quantity > 0 ? it.quantity : 1;
        const finalPrice = (originalItem.price || it.price || 0) + (originalItem.isPortion ? toppingsCost : toppingsCost / itemQty);

        return {
          ...originalItem,
          id: originalItem.id,
          name: originalItem.name,
          price: originalItem.price,
          cartId: `${originalItem.id}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          selectedToppings: toppings,
          finalPrice,
          quantity: itemQty
        };
      });

      return {
        items: aiItems.length > 0 ? aiItems : fallbackResult.items,
        destination: aiData.destination === 'Envío' || aiData.destination === 'Mesa' ? aiData.destination : (fallbackResult.destination || 'Local'),
        paymentMethod: aiData.paymentMethod || fallbackResult.paymentMethod || 'Efectivo',
        cashProvided: aiData.cashProvided || fallbackResult.cashProvided,
        client: {
          name: aiData.client?.name || fallbackResult.client.name || '',
          phone: aiData.client?.phone || fallbackResult.client.phone || '',
          address: aiData.client?.address || fallbackResult.client.address || '',
          zone: aiData.client?.zone || fallbackResult.client.zone || ''
        },
        notes: [aiData.notes, fallbackResult.notes].filter(Boolean).join(', '),
        rawTranscript: transcript,
        matchedCount: aiItems.length
      };
    }
  } catch (err) {
    console.warn('AI Voice parse failed, falling back to instant heuristic:', err);
  }

  return fallbackResult;
}

// Convert Blob to Base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Parse direct microphone audio recording using Multimodal Gemini AI
export async function parseVoiceAudioWithAI(
  audioBlob: Blob,
  menu: Record<string, MenuItem[]>,
  toppings: Topping[]
): Promise<{ transcript: string; parsed: ParsedVoiceOrder }> {
  try {
    const audioBase64 = await blobToBase64(audioBlob);
    const mimeType = audioBlob.type || 'audio/webm';

    const res = await fetch('/api/parse-voice-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        mimeType,
        menu,
        toppings
      })
    });

    const json = await res.json();
    if (json.success && json.data) {
      const aiData = json.data;
      const transcript = json.transcript || aiData.transcript || '';

      const allMenuItems: MenuItem[] = [];
      Object.values(menu).forEach(list => { if (Array.isArray(list)) allMenuItems.push(...list); });

      const aiItems: CartItem[] = (aiData.items || []).map((it: any) => {
        const originalItem = allMenuItems.find(m => m.id === it.id || m.name.toLowerCase() === (it.name || '').toLowerCase()) || {
          id: it.id || `custom-${Date.now()}`,
          name: it.name || 'Producto',
          price: it.price || 0,
          isPortion: it.isPortion,
          isMeter: it.isMeter,
          hasToppings: it.hasToppings
        };

        const toppingsList: Topping[] = Array.isArray(it.selectedToppings) ? it.selectedToppings : [];
        const toppingsCost = calculateToppingsCost(originalItem, toppingsList);
        const itemQty = it.quantity && it.quantity > 0 ? it.quantity : 1;
        const finalPrice = (originalItem.price || it.price || 0) + (originalItem.isPortion ? toppingsCost : toppingsCost / itemQty);

        return {
          ...originalItem,
          id: originalItem.id,
          name: originalItem.name,
          price: originalItem.price,
          cartId: `${originalItem.id}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          selectedToppings: toppingsList,
          finalPrice,
          quantity: itemQty
        };
      });

      return {
        transcript,
        parsed: {
          items: aiItems,
          destination: aiData.destination === 'Envío' || aiData.destination === 'Mesa' ? aiData.destination : 'Local',
          paymentMethod: aiData.paymentMethod || 'Efectivo',
          cashProvided: aiData.cashProvided,
          client: {
            name: aiData.client?.name || '',
            phone: aiData.client?.phone || '',
            address: aiData.client?.address || '',
            zone: aiData.client?.zone || ''
          },
          notes: aiData.notes || '',
          rawTranscript: transcript,
          matchedCount: aiItems.length
        }
      };
    }
  } catch (err) {
    console.error('Error parsing audio with Gemini AI:', err);
  }

  throw new Error('No se pudo procesar el audio directamente.');
}
