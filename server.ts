import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy GoogleGenAI getter
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// API Route for intelligent voice order parsing from Direct Audio
app.post('/api/parse-voice-audio', async (req, res) => {
  try {
    const { audioBase64, mimeType, menu, toppings } = req.body;
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Audio en base64 requerido' });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.json({
        success: false,
        fallback: true,
        message: 'No GEMINI_API_KEY configured'
      });
    }

    const prompt = `Eres el sistema central de toma de pedidos por voz para la Pizzería "El Árbol" en Uruguay.
Escucha atentamente el audio adjunto en español rioplatense/uruguayo con acento local.
Transcribe fielmente lo que dice el audio y clasifícalo en los productos exactos del menú de la pizzería.

Menú disponible y precios:
${JSON.stringify(menu, null, 2)}

Gustos / Toppings disponibles:
${JSON.stringify(toppings, null, 2)}

REGLAS DE RECONOCIMIENTO Y NEGOCIO URUGUAYO:
1. FAINÁ (MÁXIMA PRIORIDAD - NUNCA CONFUNDIR CON PIZZA):
   - "fainá común" / "faina común" / "faina" / "fainá" / "un fainá" / "dos fainás" / "final" -> Fainá Común (id 'f1', $100).
   - "fainá con muzzarella" / "fainá con mozzarella" / "faina con queso" / "fainá con muza" / "faina con mozza" -> Fainá con Muzzarella (id 'f2', $150).
   - "fainá de la casa JPM" / "faina de la casa jpm" / "faina jpm" / "fainá especial" -> Fainá de la casa "JPM" (id 'f3', $190).
   - "fainá DDL" / "faina ddl" / "fainá con dulce de leche" -> Fainá DDL (id 'f4', $170).

2. FIGAZAS:
   - "figaza común" / "figaza comun" -> Figaza Común (id 'fg1', $190).
   - "figaza con mozzarella" / "figaza con muzzarella" / "figaza con queso" -> Figaza con Muzzarella (id 'fg2', $250).

3. PROMOS Y COMBOS:
   - "1 metro de mozzarella más dos fainás" / "1 metro de mozzarella + 2 fainás" / "1 metro de muza más 2 faina" -> 1 Metro Muzzarella + 2 Fainás (id 'pr1', $890).
   - "1 metro de mozzarella, dos fainás y un chajá" / "1 metro de mozzarella + 2 fainás + 1 chajá" -> 1 Metro Muzzarella + 2 Fainás + 1 Chajá (id 'pr2', $1050).
   - "1 metro de mozzarella, dos fainás y dos flanes" / "1 metro de mucha, dos fainás, dos flanes, promo" -> 1 Metro Muzzarella + 2 Fainás + 2 Flanes (id 'pr3', $1150).
   - "1 metro de mucha, dos fainás, refresco 1.5 litros (promo)" / "1 metro muzzarella + 2 fainás + refresco 1.5L" -> 1 Metro Muzzarella + 2 Fainás + Refresco 1.5L (id 'pr4', $1020).

4. PIZZAS Y METROS:
   - "pizza de mozzarella" / "pizza de muzzarella" / "una muzzarella" / "porción de muzzarella" / "una de muza" -> Pizza Muzzarella (porción) (id 'p6', $230).
   - "pizza común" / "una común" / "porción de común" / "porción de pizza" (sin queso) -> Pizza Común (porción) (id 'p3', $180).
   - "1 metro de mozzarella" / "1 metro de muzzarella" / "un metro de muza" -> Pizza Muzzarella x metro (id 'p4', $750).
   - "1/2 metro de mozzarella" / "medio metro de muza" / "medio metro de mozzarella" -> Pizza Muzzarella 1/2 metro (id 'p5', $400).
   - "1 metro de pizza común" / "1 metro común" / "un metro común" -> Pizza Común x metro (id 'p1', $550).
   - "medio metro común" / "1/2 metro común" -> Pizza Común 1/2 metro (id 'p2', $300).

5. PIZZETAS:
   - "pizzeta mozzarella" / "pizzeta muzzarella" -> Pizzeta Muzzarella (id 'pz1', $320).
   - "pizzeta napolitana" -> Pizzeta Napolitana (id 'pz2', $380).
   - "pizzeta calabreza" / "pizzeta calabresa" -> Pizzeta Calabresa (id 'pz3', $390).
   - "pizzeta 4 quesos" / "pizzeta cuatro quesos" -> Pizzeta 4 Quesos (id 'pz4', $420).
   - "pizzeta hawaiana" -> Pizzeta Hawaiana (id 'pz5', $410).
   - "pizzeta americana" -> Pizzeta Americana (id 'pz6', $410).
   - "pizzeta rockeford" / "pizzeta roquefort" / "pizzeta roquefort y cebolla" -> Pizzeta Roquefort y Cebolla (id 'pz7', $430).
   - "pizzeta rúcula y tomate" / "pizzeta rucula y tomate" -> Pizzeta Rúcula y Tomate (id 'pz8', $410).
   - "pizzeta jamón y champiñones" -> Pizzeta Jamón y Champiñones (id 'pz9', $430).
   - "pizzeta jamón y aceitunas" -> Pizzeta Jamón y Aceitunas (id 'pz10', $390).
   - "pizzeta caprese" / "pizzeta capresse" -> Pizzeta Capresse (id 'pz11', $400).

6. SÁNDWICHES:
   - "sándwich caliente" / "sandwich caliente" / "tostado" -> Sándwich Caliente (id 's1', $320).
   - "sándwich caliente con mozzarella" / "sándwich caliente con mozza" / "sándwich con queso" -> Sándwich Caliente con Muzzarella (id 's2', $380).
   - "sándwich napolitano" / "sandwich napolitano" -> Sándwich Napolitano (id 's3', $420).

7. BEBIDAS, CERVEZAS, AGUAS, WHISKY, VINOS:
   - "Refresco 600 ml" / "coca 600" / "coca chica" -> Refresco 600 ml (id 'b1', $110).
   - "Refresco 1 litro" / "coca de 1 litro" -> Refresco 1 litro (id 'b2', $150).
   - "Refresco 1.5 litros" / "coca de litro y medio" / "refresco" sin especificar tamaño -> Refresco 1.5 litros (id 'b3', $185).
   - "Cerveza Patricia 1 litro" / "Patricia 1 litro" / "cerveza Patricia" -> Cerveza Patricia 1 litro (id 'b4', $270).
   - "Cerveza Pilsen 1 litro" / "Pilsen 1 litro" / "cerveza Pilsen" -> Cerveza Pilsen 1 litro (id 'b5', $260).
   - "Cerveza Zillertal 1 litro" -> Cerveza Zillertal 1 litro (id 'b6', $290).
   - "Cerveza S Miller 1 litro" / "cerveza Miller 1 litro" / "Miller" -> Cerveza S Miller 1 litro (id 'b7_mil', $280).
   - "Cerveza A 1 litro" / "cerveza Stella Artois 1 litro" / "Stella Artois" -> Cerveza A (Stella Artois) 1 litro (id 'b7_ste', $290).
   - "Cerveza Corona 330" / "Corona 330" / "Coronita" -> Cerveza Corona 330 (id 'b7_cor', $160).
   - "Cerveza artesanal" -> Cerveza artesanal (id 'b7_art', $220).
   - "Agua Salus 600 ml" / "agua salus chica" -> Agua Salus 600 ml (id 'b8', $80).
   - "Agua Salus 1.5 litros" / "agua salus litro y medio" -> Agua Salus 1.5 litros (id 'b9', $120).
   - "Salus Frute 600 ml" / "salus frutté 600" -> Salus Frute 600 ml (id 'b10_sf6', $95).
   - "Salus Frute 1.5 litros" / "salus frutté 1.5" -> Salus Frute 1.5 litros (id 'b11_sf15', $140).
   - "Whisky" / "medida de whisky" -> Whisky (id 'b12_w', $190).
   - "Rose extinto" / "vino rosé / tinto" / "copa de vino" -> Rose extinto (Vino Rosé/Tinto) (id 'b13_v', $170).

8. POSTRES:
   - "chaja" / "chajá" / "postre chajá" -> Chaja (id 'pt1', $210).
   - "flan" / "flan casero" -> Flan (id 'pt2', $160).

9. COSTOS EXTRAS / ENVÍO:
   - "costo de envío" / "envío" -> Costo de envío (id 'ext1', $70).
   - "costo extra fijo" -> Costo extra fijo (id 'ext2', $50).

10. DETECCIÓN MULTIPRODUCTO: Extrae TODOS los productos que mencione el hablante con su cantidad correspondiente.

Devuelve SOLAMENTE un objeto JSON válido con la siguiente estructura exacta:
{
  "transcript": "Transcripción fiel en texto de lo que dijo el usuario",
  "items": [
    {
      "id": "id del producto del menú",
      "name": "nombre del producto",
      "price": 0,
      "quantity": 1,
      "selectedToppings": [
        { "id": "t...", "name": "Nombre gusto", "price": 0 }
      ],
      "isMeter": false,
      "isPortion": false,
      "notes": ""
    }
  ],
  "destination": "Local" | "Envío" | "Mesa",
  "reference": "referencia o mesa",
  "paymentMethod": "Efectivo" | "Tarjeta" | "Débito" | "Transferencia",
  "cashProvided": 0,
  "client": {
    "name": "",
    "phone": "",
    "address": "",
    "zone": ""
  },
  "notes": "notas generales del pedido",
  "confidenceSummary": "Resumen breve de los productos y destino detectados"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'audio/webm',
            data: audioBase64,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const parsedText = response.text?.trim() || '{}';
    let structured;
    try {
      structured = JSON.parse(parsedText);
    } catch {
      structured = null;
    }

    if (!structured || !Array.isArray(structured.items)) {
      return res.json({ success: false, fallback: true });
    }

    return res.json({
      success: true,
      transcript: structured.transcript || '',
      data: structured
    });
  } catch (error: any) {
    console.error('Error in parse-voice-audio:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Error processing voice audio' });
  }
});

// API Route for intelligent voice order parsing from Text
app.post('/api/parse-voice-order', async (req, res) => {
  try {
    const { transcript, menu, toppings } = req.body;
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Transcripción requerida' });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.json({
        success: false,
        fallback: true,
        message: 'No GEMINI_API_KEY configured, client heuristic parser will be used.'
      });
    }

    const prompt = `Eres un asistente de punto de venta (POS) para la Pizzería "El Árbol" en Uruguay.
Analiza la transcripción de un pedido de voz o texto (puede contener múltiples productos dichos de corrido, errores de reconocimiento de audio o modismos uruguayos) y extrae TODOS los productos en un array JSON estructurado.

Menú disponible y precios:
${JSON.stringify(menu, null, 2)}

Gustos / Toppings disponibles:
${JSON.stringify(toppings, null, 2)}

Transcripción de pedido: "${transcript}"

REGLAS CRÍTICAS DE DETECCIÓN Y NEGOCIO URUGUAYO:
1. DETECCIÓN MULTIPRODUCTO COMPLETA (OBLIGATORIO):
   - Si el cliente menciona varios productos en una sola frase (ej: "una pizza de mozzarella, dos fainá común, un sándwich caliente con queso y una cerveza patricia"), DEBES EXTRAER TODOS Y CADA UNO DE LOS PRODUCTOS en el array "items". No omitas ninguno.
   - Cada producto debe tener su "quantity" correspondiente (ej: si dice "dos fainá", quantity es 2).

2. FAINÁ (MÁXIMA PRIORIDAD - NUNCA CONFUNDIR CON PIZZA):
   - "fainá común" / "faina común" / "faina" / "fainá" / "un fainá" / "dos fainás" / "final" -> Fainá Común (id 'f1', $100).
   - "fainá con muzzarella" / "fainá con mozzarella" / "faina con queso" / "fainá con muza" / "faina con mozza" -> Fainá con Muzzarella (id 'f2', $150).
   - "fainá de la casa JPM" / "faina de la casa jpm" / "faina jpm" / "fainá especial" -> Fainá de la casa "JPM" (id 'f3', $190).
   - "fainá DDL" / "faina ddl" / "fainá con dulce de leche" -> Fainá DDL (id 'f4', $170).

3. FIGAZAS:
   - "figaza común" / "figaza comun" -> Figaza Común (id 'fg1', $190).
   - "figaza con mozzarella" / "figaza con muzzarella" / "figaza con queso" -> Figaza con Muzzarella (id 'fg2', $250).

4. PROMOS Y COMBOS:
   - "1 metro de mozzarella más dos fainás" / "1 metro de mozzarella + 2 fainás" / "1 metro de muza más 2 faina" -> 1 Metro Muzzarella + 2 Fainás (id 'pr1', $890).
   - "1 metro de mozzarella, dos fainás y un chajá" / "1 metro de mozzarella + 2 fainás + 1 chajá" -> 1 Metro Muzzarella + 2 Fainás + 1 Chajá (id 'pr2', $1050).
   - "1 metro de mozzarella, dos fainás y dos flanes" / "1 metro de mucha, dos fainás, dos flanes, promo" -> 1 Metro Muzzarella + 2 Fainás + 2 Flanes (id 'pr3', $1150).
   - "1 metro de mucha, dos fainás, refresco 1.5 litros (promo)" / "1 metro muzzarella + 2 fainás + refresco 1.5L" -> 1 Metro Muzzarella + 2 Fainás + Refresco 1.5L (id 'pr4', $1020).

5. REGLA FUNDAMENTAL DE PIZZA Y MUZZARELLA URUGUAYA:
   - "Pizza de mozzarella" / "pizza de muzzarella" / "pizza con mozzarella" / "pizza con muzzarella" / "pizza mozzarella" / "una mozzarella" / "una muzzarella" / "una de muza" / "una de moza" / "porción de muzzarella" -> SE MAPEA A "Pizza Muzzarella (porción)" (id 'p6', $230).
   - "Una pizza" / "1 pizza" / "pizza común" / "porción de pizza" / "una porción" / "1 de común" / "una pizza común" -> SE MAPEA A "Pizza Común (porción)" (id 'p3', $180, SIN mozzarella).
   - "Un metro de mozzarella" / "un metro de muzzarella" / "1 metro de muza" / "1 metro de moza" / "un metro de mucha" -> SE MAPEA A "Pizza Muzzarella x metro" (id 'p4', $750).
   - "Un metro" / "1 metro" / "un metro común" / "1 metro de común" -> SE MAPEA A "Pizza Común x metro" (id 'p1', $550).
   - "Medio metro de mozzarella" / "1/2 metro de muza" / "medio metro de muzzarella" -> SE MAPEA A "Pizza Muzzarella 1/2 metro" (id 'p5', $400).
   - "Medio metro común" / "1/2 metro común" -> SE MAPEA A "Pizza Común 1/2 metro" (id 'p2', $300).

6. PIZZETAS:
   - "pizzeta mozzarella" / "pizzeta muzzarella" -> Pizzeta Muzzarella (id 'pz1', $320).
   - "pizzeta napolitana" -> Pizzeta Napolitana (id 'pz2', $380).
   - "pizzeta calabreza" / "pizzeta calabresa" -> Pizzeta Calabresa (id 'pz3', $390).
   - "pizzeta 4 quesos" / "pizzeta cuatro quesos" -> Pizzeta 4 Quesos (id 'pz4', $420).
   - "pizzeta hawaiana" -> Pizzeta Hawaiana (id 'pz5', $410).
   - "pizzeta americana" -> Pizzeta Americana (id 'pz6', $410).
   - "pizzeta rockeford" / "pizzeta roquefort" / "pizzeta roquefort y cebolla" -> Pizzeta Roquefort y Cebolla (id 'pz7', $430).
   - "pizzeta rúcula y tomate" / "pizzeta rucula y tomate" -> Pizzeta Rúcula y Tomate (id 'pz8', $410).
   - "pizzeta jamón y champiñones" -> Pizzeta Jamón y Champiñones (id 'pz9', $430).
   - "pizzeta jamón y aceitunas" -> Pizzeta Jamón y Aceitunas (id 'pz10', $390).
   - "pizzeta caprese" / "pizzeta capresse" -> Pizzeta Capresse (id 'pz11', $400).

7. SÁNDWICHES:
   - "sandwich caliente" / "sandwiches calientes" / "tostados" -> Sándwich Caliente (id 's1', $320).
   - "sandwich caliente con muzzarella" / "sandwich caliente con mozza" / "sandwich con queso" -> Sándwich Caliente con Muzzarella (id 's2', $380).
   - "sandwich napolitano" -> Sándwich Napolitano (id 's3', $420).

8. BEBIDAS (REFRESCOS, CERVEZAS, AGUAS, WHISKY, VINOS):
   - "Refresco 600 ml" / "coca 600" / "coca chica" -> Refresco 600 ml (id 'b1', $110).
   - "Refresco 1 litro" / "coca de 1 litro" -> Refresco 1 litro (id 'b2', $150).
   - "Refresco 1.5 litros" / "coca de litro y medio" / "refresco" sin tamaño -> Refresco 1.5 litros (id 'b3', $185).
   - "Cerveza Patricia 1 litro" / "Patricia 1 litro" -> Cerveza Patricia 1 litro (id 'b4', $270).
   - "Cerveza Pilsen 1 litro" / "Pilsen 1 litro" -> Cerveza Pilsen 1 litro (id 'b5', $260).
   - "Cerveza Zillertal 1 litro" -> Cerveza Zillertal 1 litro (id 'b6', $290).
   - "Cerveza S Miller 1 litro" / "Miller" -> Cerveza S Miller 1 litro (id 'b7_mil', $280).
   - "Cerveza A 1 litro" / "Stella Artois" -> Cerveza A (Stella Artois) 1 litro (id 'b7_ste', $290).
   - "Cerveza Corona 330" / "Corona" / "Coronita" -> Cerveza Corona 330 (id 'b7_cor', $160).
   - "Cerveza artesanal" -> Cerveza artesanal (id 'b7_art', $220).
   - "Agua Salus 600 ml" / "salus chica" -> Agua Salus 600 ml (id 'b8', $80).
   - "Agua Salus 1.5 litros" / "salus litro y medio" -> Agua Salus 1.5 litros (id 'b9', $120).
   - "Salus Frute 600 ml" / "salus frutté 600" -> Salus Frute 600 ml (id 'b10_sf6', $95).
   - "Salus Frute 1.5 litros" / "salus frutté 1.5" -> Salus Frute 1.5 litros (id 'b11_sf15', $140).
   - "Whisky" -> Whisky (id 'b12_w', $190).
   - "Rose extinto" / "vino rosé / tinto" -> Rose extinto (Vino Rosé/Tinto) (id 'b13_v', $170).

9. POSTRES:
   - "chaja" / "chajá" / "postre chajá" -> Chaja (id 'pt1', $210).
   - "flan" / "flan casero" -> Flan (id 'pt2', $160).

10. EXTRAS:
   - "costo de envío" / "envío" -> Costo de envío (id 'ext1', $70).
   - "costo extra fijo" -> Costo extra fijo (id 'ext2', $50).

11. GUSTOS / TOPPINGS:
   - Asigna los gustos mencionados ("panceta", "aceitunas", "jamón", "huevo frito", "cebolla caramelizada", "ananá", "champiñones", "roquefort", "rúcula", etc.) al producto específico al que corresponden en "selectedToppings".

12. Destino / Servicio:
   - "mostrador", "para llevar", "retiro", "local", "takeaway" -> "Local"
   - "delivery", "envío", "a domicilio", "mandar a", "para entregar en" -> "Envío"
   - "mesa 1", "mesa 2", "para comer acá", "mesa" -> "Mesa"
   - Default: "Local"

13. Método de pago y cambio:
   - "efectivo", "cash", "pesos" -> "Efectivo"
   - "tarjeta", "pos", "crédito" -> "Tarjeta"
   - "débito", "debito" -> "Débito"
   - "transferencia", "prex", "banco" -> "Transferencia"
   - Si menciona con cuánto paga (ej: "paga con 2000", "paga con dos mil"), extraer "cashProvided" como número.

14. Datos de cliente: Extraer "name", "phone", "address", "zone", "notes" si están presentes.

Devuelve SOLAMENTE un objeto JSON válido con la siguiente estructura exacta:
{
  "items": [
    {
      "id": "id del producto del menú",
      "name": "nombre del producto",
      "price": 0,
      "quantity": 1,
      "selectedToppings": [
        { "id": "t...", "name": "Nombre gusto", "price": 0 }
      ],
      "isMeter": false,
      "isPortion": false,
      "notes": ""
    }
  ],
  "destination": "Local" | "Envío" | "Mesa",
  "reference": "referencia o mesa",
  "paymentMethod": "Efectivo" | "Tarjeta" | "Débito" | "Transferencia",
  "cashProvided": 0,
  "client": {
    "name": "",
    "phone": "",
    "address": "",
    "zone": ""
  },
  "notes": "notas generales del pedido",
  "confidenceSummary": "Resumen breve de los productos y destino detectados"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const parsedText = response.text?.trim() || '{}';
    let structured;
    try {
      structured = JSON.parse(parsedText);
    } catch {
      structured = null;
    }

    if (!structured || !Array.isArray(structured.items)) {
      return res.json({ success: false, fallback: true });
    }

    return res.json({ success: true, data: structured });
  } catch (error: any) {
    console.error('Error in parse-voice-order:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Error parsing voice order' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pizzeria El Arbol POS running on port ${PORT}`);
  });
}

startServer();
