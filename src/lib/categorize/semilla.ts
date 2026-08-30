/**
 * Diccionario semilla de comercios argentinos.
 *
 * Reemplaza a la capa LLM: cubre ~65% de un resumen típico desde el primer
 * import, sin costo ni conexión. El resto lo categorizás una vez y la memoria
 * de comercios se encarga para siempre.
 *
 * IMPORTANTE: el matcher ordena por longitud de patrón DESCENDENTE, así el más
 * específico gana. Es lo que resuelve colisiones como "PUMA ENERGY" (nafta) vs
 * "PUMA" (indumentaria).
 */

export interface EntradaSemilla {
  /** Se busca como substring dentro de la clave normalizada. */
  patron: string;
  /** Nombre canónico para mostrar. */
  comercio: string;
  categoria: string;
  subcategoria?: string;
}

export const SEMILLA: readonly EntradaSemilla[] = [
  // ---------- Supermercado y hogar ----------
  { patron: "COTO", comercio: "Coto", categoria: "supermercado", subcategoria: "Supermercado" },
  { patron: "CARREFOUR", comercio: "Carrefour", categoria: "supermercado", subcategoria: "Supermercado" },
  { patron: "JUMBO", comercio: "Jumbo", categoria: "supermercado", subcategoria: "Supermercado" },
  { patron: "DISCO", comercio: "Disco", categoria: "supermercado", subcategoria: "Supermercado" },
  { patron: "SUPERMERCADO DIA", comercio: "Dia", categoria: "supermercado", subcategoria: "Supermercado" },
  { patron: "VEA DIGITAL", comercio: "Vea", categoria: "supermercado", subcategoria: "Supermercado" },
  { patron: "LA ANONIMA", comercio: "La Anónima", categoria: "supermercado", subcategoria: "Supermercado" },
  { patron: "CHANGOMAS", comercio: "ChangoMas", categoria: "supermercado", subcategoria: "Supermercado" },
  { patron: "WALMART", comercio: "Walmart", categoria: "supermercado", subcategoria: "Supermercado" },
  { patron: "MAKRO", comercio: "Makro", categoria: "supermercado", subcategoria: "Supermercado" },
  { patron: "DIARCO", comercio: "Diarco", categoria: "supermercado", subcategoria: "Supermercado" },
  { patron: "MAXICONSUMO", comercio: "Maxiconsumo", categoria: "supermercado", subcategoria: "Supermercado" },
  { patron: "VERDULERIA", comercio: "Verdulería", categoria: "supermercado", subcategoria: "Almacén y verdulería" },
  { patron: "CARNICERIA", comercio: "Carnicería", categoria: "supermercado", subcategoria: "Almacén y verdulería" },
  { patron: "FIAMBRE", comercio: "Fiambrería", categoria: "supermercado", subcategoria: "Almacén y verdulería" },
  { patron: "PANADERIA", comercio: "Panadería", categoria: "supermercado", subcategoria: "Almacén y verdulería" },
  { patron: "PUPPIS", comercio: "Puppis", categoria: "supermercado", subcategoria: "Mascotas" },
  { patron: "VETERINARIA", comercio: "Veterinaria", categoria: "supermercado", subcategoria: "Mascotas" },

  // ---------- Gastronomía ----------
  { patron: "RAPPI", comercio: "Rappi", categoria: "gastronomia", subcategoria: "Delivery" },
  { patron: "PEDIDOSYA", comercio: "PedidosYa", categoria: "gastronomia", subcategoria: "Delivery" },
  { patron: "PEDIDOS YA", comercio: "PedidosYa", categoria: "gastronomia", subcategoria: "Delivery" },
  { patron: "PEYA", comercio: "PedidosYa", categoria: "gastronomia", subcategoria: "Delivery" },
  { patron: "UBER EATS", comercio: "Uber Eats", categoria: "gastronomia", subcategoria: "Delivery" },
  { patron: "MCDONALDS", comercio: "McDonald's", categoria: "gastronomia", subcategoria: "Restaurantes" },
  { patron: "ARCOS DORADOS", comercio: "McDonald's", categoria: "gastronomia", subcategoria: "Restaurantes" },
  { patron: "ARCOSDORADOS", comercio: "McDonald's", categoria: "gastronomia", subcategoria: "Restaurantes" },
  { patron: "BURGER KING", comercio: "Burger King", categoria: "gastronomia", subcategoria: "Restaurantes" },
  { patron: "MOSTAZA", comercio: "Mostaza", categoria: "gastronomia", subcategoria: "Restaurantes" },
  { patron: "SUBWAY", comercio: "Subway", categoria: "gastronomia", subcategoria: "Restaurantes" },
  { patron: "KANSAS", comercio: "Kansas", categoria: "gastronomia", subcategoria: "Restaurantes" },
  { patron: "STARBUCKS", comercio: "Starbucks", categoria: "gastronomia", subcategoria: "Cafés y bares" },
  { patron: "HAVANNA", comercio: "Havanna", categoria: "gastronomia", subcategoria: "Cafés y bares" },
  { patron: "BONAFIDE", comercio: "Bonafide", categoria: "gastronomia", subcategoria: "Cafés y bares" },
  { patron: "TIENDA DE CAFE", comercio: "Tienda de Café", categoria: "gastronomia", subcategoria: "Cafés y bares" },
  { patron: "GRIDO", comercio: "Grido", categoria: "gastronomia", subcategoria: "Cafés y bares" },
  { patron: "FREDDO", comercio: "Freddo", categoria: "gastronomia", subcategoria: "Cafés y bares" },
  { patron: "PIZZERIA", comercio: "Pizzería", categoria: "gastronomia", subcategoria: "Restaurantes" },
  { patron: "PARRILLA", comercio: "Parrilla", categoria: "gastronomia", subcategoria: "Restaurantes" },
  { patron: "TRATTORIA", comercio: "Trattoria", categoria: "gastronomia", subcategoria: "Restaurantes" },
  { patron: "ROTISERIA", comercio: "Rotisería", categoria: "gastronomia", subcategoria: "Restaurantes" },
  { patron: "KIOSCO", comercio: "Kiosco", categoria: "gastronomia", subcategoria: "Kiosco" },

  // ---------- Transporte ----------
  { patron: "PUMA ENERGY", comercio: "Puma Energy", categoria: "transporte", subcategoria: "Combustible" },
  { patron: "YPF", comercio: "YPF", categoria: "transporte", subcategoria: "Combustible" },
  { patron: "SHELL", comercio: "Shell", categoria: "transporte", subcategoria: "Combustible" },
  { patron: "AXION", comercio: "Axion", categoria: "transporte", subcategoria: "Combustible" },
  { patron: "GULF", comercio: "Gulf", categoria: "transporte", subcategoria: "Combustible" },
  { patron: "REFINOR", comercio: "Refinor", categoria: "transporte", subcategoria: "Combustible" },
  { patron: "UBER", comercio: "Uber", categoria: "transporte", subcategoria: "Apps de viaje" },
  { patron: "CABIFY", comercio: "Cabify", categoria: "transporte", subcategoria: "Apps de viaje" },
  { patron: "DIDI", comercio: "DiDi", categoria: "transporte", subcategoria: "Apps de viaje" },
  { patron: "SUBE", comercio: "SUBE", categoria: "transporte", subcategoria: "SUBE y transporte público" },
  { patron: "EMOVA", comercio: "Subte", categoria: "transporte", subcategoria: "SUBE y transporte público" },
  { patron: "SUBTE", comercio: "Subte", categoria: "transporte", subcategoria: "SUBE y transporte público" },
  { patron: "AUSA", comercio: "AUSA", categoria: "transporte", subcategoria: "Peajes y cochera" },
  { patron: "AUBASA", comercio: "AUBASA", categoria: "transporte", subcategoria: "Peajes y cochera" },
  { patron: "TELEPASE", comercio: "Telepase", categoria: "transporte", subcategoria: "Peajes y cochera" },
  { patron: "ESTACIONAMIENTO", comercio: "Estacionamiento", categoria: "transporte", subcategoria: "Peajes y cochera" },
  { patron: "COCHERA", comercio: "Cochera", categoria: "transporte", subcategoria: "Peajes y cochera" },
  { patron: "GOMERIA", comercio: "Gomería", categoria: "transporte", subcategoria: "Mantenimiento" },
  { patron: "LUBRICENTRO", comercio: "Lubricentro", categoria: "transporte", subcategoria: "Mantenimiento" },

  // ---------- Servicios y suscripciones ----------
  { patron: "EDENOR", comercio: "Edenor", categoria: "servicios", subcategoria: "Luz" },
  { patron: "EDESUR", comercio: "Edesur", categoria: "servicios", subcategoria: "Luz" },
  { patron: "EDEA", comercio: "EDEA", categoria: "servicios", subcategoria: "Luz" },
  { patron: "METROGAS", comercio: "Metrogas", categoria: "servicios", subcategoria: "Gas" },
  { patron: "NATURGY", comercio: "Naturgy", categoria: "servicios", subcategoria: "Gas" },
  { patron: "CAMUZZI", comercio: "Camuzzi", categoria: "servicios", subcategoria: "Gas" },
  { patron: "AYSA", comercio: "AySA", categoria: "servicios", subcategoria: "Agua" },
  { patron: "ABSA", comercio: "ABSA", categoria: "servicios", subcategoria: "Agua" },
  { patron: "FIBERTEL", comercio: "Fibertel", categoria: "servicios", subcategoria: "Internet y cable" },
  { patron: "CABLEVISION", comercio: "Cablevisión", categoria: "servicios", subcategoria: "Internet y cable" },
  { patron: "TELECENTRO", comercio: "Telecentro", categoria: "servicios", subcategoria: "Internet y cable" },
  { patron: "IPLAN", comercio: "IPLAN", categoria: "servicios", subcategoria: "Internet y cable" },
  { patron: "TELECOM", comercio: "Telecom", categoria: "servicios", subcategoria: "Internet y cable" },
  { patron: "DIRECTV", comercio: "DirecTV", categoria: "servicios", subcategoria: "Internet y cable" },
  { patron: "MOVISTAR", comercio: "Movistar", categoria: "servicios", subcategoria: "Celular" },
  { patron: "PERSONAL", comercio: "Personal", categoria: "servicios", subcategoria: "Celular" },
  { patron: "CLARO", comercio: "Claro", categoria: "servicios", subcategoria: "Celular" },
  { patron: "NETFLIX", comercio: "Netflix", categoria: "servicios", subcategoria: "Streaming" },
  { patron: "SPOTIFY", comercio: "Spotify", categoria: "servicios", subcategoria: "Streaming" },
  { patron: "DISNEY", comercio: "Disney+", categoria: "servicios", subcategoria: "Streaming" },
  { patron: "HBO", comercio: "HBO Max", categoria: "servicios", subcategoria: "Streaming" },
  { patron: "MAX HELP", comercio: "HBO Max", categoria: "servicios", subcategoria: "Streaming" },
  { patron: "PRIME VIDEO", comercio: "Prime Video", categoria: "servicios", subcategoria: "Streaming" },
  { patron: "PARAMOUNT", comercio: "Paramount+", categoria: "servicios", subcategoria: "Streaming" },
  { patron: "YOUTUBE", comercio: "YouTube", categoria: "servicios", subcategoria: "Streaming" },
  { patron: "APPLE", comercio: "Apple", categoria: "servicios", subcategoria: "Software" },
  { patron: "ICLOUD", comercio: "iCloud", categoria: "servicios", subcategoria: "Software" },
  { patron: "GOOGLE", comercio: "Google", categoria: "servicios", subcategoria: "Software" },
  { patron: "MICROSOFT", comercio: "Microsoft", categoria: "servicios", subcategoria: "Software" },
  { patron: "ADOBE", comercio: "Adobe", categoria: "servicios", subcategoria: "Software" },
  { patron: "OPENAI", comercio: "OpenAI", categoria: "servicios", subcategoria: "Software" },
  { patron: "CURSOR", comercio: "Cursor", categoria: "servicios", subcategoria: "Software" },
  { patron: "ANTHROPIC", comercio: "Anthropic", categoria: "servicios", subcategoria: "Software" },
  { patron: "GITHUB", comercio: "GitHub", categoria: "servicios", subcategoria: "Software" },
  { patron: "NOTION", comercio: "Notion", categoria: "servicios", subcategoria: "Software" },
  { patron: "FIGMA", comercio: "Figma", categoria: "servicios", subcategoria: "Software" },
  { patron: "CANVA", comercio: "Canva", categoria: "servicios", subcategoria: "Software" },
  { patron: "DROPBOX", comercio: "Dropbox", categoria: "servicios", subcategoria: "Software" },
  { patron: "VERCEL", comercio: "Vercel", categoria: "servicios", subcategoria: "Software" },
  { patron: "EXPENSAS", comercio: "Expensas", categoria: "servicios", subcategoria: "Expensas" },
  { patron: "ALQUILER", comercio: "Alquiler", categoria: "servicios", subcategoria: "Alquiler" },

  // ---------- Salud y cuidado ----------
  { patron: "FARMACITY", comercio: "Farmacity", categoria: "salud", subcategoria: "Farmacia" },
  { patron: "FARMACIA", comercio: "Farmacia", categoria: "salud", subcategoria: "Farmacia" },
  { patron: "DR AHORRO", comercio: "Dr. Ahorro", categoria: "salud", subcategoria: "Farmacia" },
  { patron: "SIMPLICITY", comercio: "Simplicity", categoria: "salud", subcategoria: "Farmacia" },
  { patron: "OSDE", comercio: "OSDE", categoria: "salud", subcategoria: "Prepaga y obra social" },
  { patron: "SWISS MEDICAL", comercio: "Swiss Medical", categoria: "salud", subcategoria: "Prepaga y obra social" },
  { patron: "GALENO", comercio: "Galeno", categoria: "salud", subcategoria: "Prepaga y obra social" },
  { patron: "MEDIFE", comercio: "Medifé", categoria: "salud", subcategoria: "Prepaga y obra social" },
  { patron: "OMINT", comercio: "Omint", categoria: "salud", subcategoria: "Prepaga y obra social" },
  { patron: "PREVENCION SALUD", comercio: "Prevención Salud", categoria: "salud", subcategoria: "Prepaga y obra social" },
  { patron: "SPORTCLUB", comercio: "SportClub", categoria: "salud", subcategoria: "Gimnasio" },
  { patron: "MEGATLON", comercio: "Megatlón", categoria: "salud", subcategoria: "Gimnasio" },
  { patron: "PELUQUERIA", comercio: "Peluquería", categoria: "salud", subcategoria: "Peluquería y estética" },
  { patron: "LABORATORIO", comercio: "Laboratorio", categoria: "salud", subcategoria: "Consultas" },

  // ---------- Compras ----------
  { patron: "MERCADOLIBRE", comercio: "Mercado Libre", categoria: "compras", subcategoria: "Electrónica" },
  { patron: "MERCADO LIBRE", comercio: "Mercado Libre", categoria: "compras", subcategoria: "Electrónica" },
  { patron: "FRAVEGA", comercio: "Frávega", categoria: "compras", subcategoria: "Electrónica" },
  { patron: "GARBARINO", comercio: "Garbarino", categoria: "compras", subcategoria: "Electrónica" },
  { patron: "MUSIMUNDO", comercio: "Musimundo", categoria: "compras", subcategoria: "Electrónica" },
  { patron: "MEGATONE", comercio: "Megatone", categoria: "compras", subcategoria: "Electrónica" },
  { patron: "CETROGAR", comercio: "Cetrogar", categoria: "compras", subcategoria: "Electrónica" },
  { patron: "FALABELLA", comercio: "Falabella", categoria: "compras", subcategoria: "Indumentaria" },
  { patron: "ZARA", comercio: "Zara", categoria: "compras", subcategoria: "Indumentaria" },
  { patron: "ADIDAS", comercio: "Adidas", categoria: "compras", subcategoria: "Indumentaria" },
  { patron: "NIKE", comercio: "Nike", categoria: "compras", subcategoria: "Indumentaria" },
  { patron: "PUMA", comercio: "Puma", categoria: "compras", subcategoria: "Indumentaria" },
  { patron: "DEXTER", comercio: "Dexter", categoria: "compras", subcategoria: "Indumentaria" },
  { patron: "STOCK CENTER", comercio: "Stock Center", categoria: "compras", subcategoria: "Indumentaria" },
  { patron: "EASY", comercio: "Easy", categoria: "compras", subcategoria: "Muebles y deco" },
  { patron: "SODIMAC", comercio: "Sodimac", categoria: "compras", subcategoria: "Muebles y deco" },
  { patron: "AMAZON", comercio: "Amazon", categoria: "compras", subcategoria: "Electrónica" },
  { patron: "ALIEXPRESS", comercio: "AliExpress", categoria: "compras", subcategoria: "Electrónica" },
  { patron: "SHEIN", comercio: "Shein", categoria: "compras", subcategoria: "Indumentaria" },
  { patron: "TEMU", comercio: "Temu", categoria: "compras", subcategoria: "Indumentaria" },
  { patron: "LIBRERIA", comercio: "Librería", categoria: "compras", subcategoria: "Librería" },
  { patron: "YENNY", comercio: "Yenny / El Ateneo", categoria: "compras", subcategoria: "Librería" },

  // ---------- Ocio y viajes ----------
  { patron: "CINEMARK", comercio: "Cinemark", categoria: "joda", subcategoria: "Cine y teatro" },
  { patron: "HOYTS", comercio: "Hoyts", categoria: "joda", subcategoria: "Cine y teatro" },
  { patron: "VILLAGE CINE", comercio: "Village Cines", categoria: "joda", subcategoria: "Cine y teatro" },
  { patron: "CINEPOLIS", comercio: "Cinépolis", categoria: "joda", subcategoria: "Cine y teatro" },
  { patron: "TICKETEK", comercio: "Ticketek", categoria: "joda", subcategoria: "Recitales y eventos" },
  { patron: "PASSLINE", comercio: "Passline", categoria: "joda", subcategoria: "Recitales y eventos" },
  { patron: "DESPEGAR", comercio: "Despegar", categoria: "viajes", subcategoria: "Pasajes" },
  { patron: "BOOKING", comercio: "Booking.com", categoria: "viajes", subcategoria: "Hotelería" },
  { patron: "AIRBNB", comercio: "Airbnb", categoria: "viajes", subcategoria: "Hotelería" },
  { patron: "AEROLINEAS", comercio: "Aerolíneas Argentinas", categoria: "viajes", subcategoria: "Pasajes" },
  { patron: "FLYBONDI", comercio: "Flybondi", categoria: "viajes", subcategoria: "Pasajes" },
  { patron: "JETSMART", comercio: "JetSmart", categoria: "viajes", subcategoria: "Pasajes" },
  { patron: "LATAM", comercio: "LATAM", categoria: "viajes", subcategoria: "Pasajes" },
  { patron: "UDEMY", comercio: "Udemy", categoria: "servicios", subcategoria: "Educación" },
  { patron: "PLATZI", comercio: "Platzi", categoria: "servicios", subcategoria: "Educación" },
  { patron: "COURSERA", comercio: "Coursera", categoria: "servicios", subcategoria: "Educación" },
  { patron: "UADE", comercio: "UADE", categoria: "servicios", subcategoria: "Educación" },

  // ---------- Impuestos y bancarios ----------
  { patron: "PERCEPCION", comercio: "Percepción", categoria: "financiero", subcategoria: "Percepciones" },
  { patron: "PERC IB", comercio: "Percepción Ingresos Brutos", categoria: "financiero", subcategoria: "Percepciones" },
  { patron: "CR RG", comercio: "Devolución de percepción", categoria: "financiero", subcategoria: "Percepciones" },
  { patron: "PAGO ERRONEO", comercio: "Ajuste del banco", categoria: "financiero" },
  { patron: "DEVOLUCION", comercio: "Devolución", categoria: "financiero" },
  { patron: "IMPUESTO", comercio: "Impuesto", categoria: "financiero", subcategoria: "Impuestos" },
  { patron: "IVA", comercio: "IVA", categoria: "financiero", subcategoria: "Impuestos" },
  { patron: "INGRESOS BRUTOS", comercio: "Ingresos Brutos", categoria: "financiero", subcategoria: "Impuestos" },
  { patron: "SIRCREB", comercio: "SIRCREB", categoria: "financiero", subcategoria: "Impuestos" },
  { patron: "LEY 25413", comercio: "Impuesto al cheque", categoria: "financiero", subcategoria: "Impuestos" },
  { patron: "AFIP", comercio: "AFIP / ARCA", categoria: "financiero", subcategoria: "Impuestos" },
  { patron: "ARCA", comercio: "AFIP / ARCA", categoria: "financiero", subcategoria: "Impuestos" },
  { patron: "RENTAS", comercio: "Rentas", categoria: "financiero", subcategoria: "Impuestos" },
  { patron: "ABL", comercio: "ABL", categoria: "financiero", subcategoria: "Impuestos" },
  { patron: "COMISION", comercio: "Comisión bancaria", categoria: "financiero", subcategoria: "Comisiones" },
  { patron: "MANTENIMIENTO DE CUENTA", comercio: "Mantenimiento de cuenta", categoria: "financiero", subcategoria: "Comisiones" },
  { patron: "INTERES", comercio: "Intereses", categoria: "financiero", subcategoria: "Intereses" },
  { patron: "SEGURO", comercio: "Seguro", categoria: "financiero", subcategoria: "Seguros" },

  // ---------- Ingresos ----------
  { patron: "ACREDITACION HABERES", comercio: "Sueldo", categoria: "ingresos", subcategoria: "Sueldo" },
  { patron: "HABERES", comercio: "Sueldo", categoria: "ingresos", subcategoria: "Sueldo" },
  { patron: "SUELDO", comercio: "Sueldo", categoria: "ingresos", subcategoria: "Sueldo" },
  { patron: "DEVOLUCION", comercio: "Devolución", categoria: "ingresos", subcategoria: "Reintegros" },
  { patron: "REINTEGRO", comercio: "Reintegro", categoria: "ingresos", subcategoria: "Reintegros" },
  { patron: "BONIFICACION", comercio: "Bonificación", categoria: "ingresos", subcategoria: "Reintegros" },

  // ---------- Ahorro e inversión ----------
  { patron: "PLAZO FIJO", comercio: "Plazo fijo", categoria: "inversion", subcategoria: "Plazo fijo" },
  { patron: "COMPRA DE DOLARES", comercio: "Compra de dólares", categoria: "inversion", subcategoria: "Dólares" },
  { patron: "FONDO COMUN", comercio: "Fondo común", categoria: "inversion", subcategoria: "Fondos" },
  { patron: "BINANCE", comercio: "Binance", categoria: "inversion", subcategoria: "Acciones y cripto" },
  { patron: "BUENBIT", comercio: "Buenbit", categoria: "inversion", subcategoria: "Acciones y cripto" },
  { patron: "LEMON", comercio: "Lemon", categoria: "inversion", subcategoria: "Acciones y cripto" },
  { patron: "COCOS CAPITAL", comercio: "Cocos Capital", categoria: "inversion", subcategoria: "Acciones y cripto" },
  { patron: "IOL INVERTIR", comercio: "IOL", categoria: "inversion", subcategoria: "Acciones y cripto" },
  { patron: "BALANZ", comercio: "Balanz", categoria: "inversion", subcategoria: "Fondos" },

  // ---------- Movimientos internos (NO son gasto) ----------
  { patron: "SU PAGO EN PESOS", comercio: "Pago de tarjeta", categoria: "interno", subcategoria: "Pago de tarjeta" },
  { patron: "PAGO DE TARJETA", comercio: "Pago de tarjeta", categoria: "interno", subcategoria: "Pago de tarjeta" },
  { patron: "SU PAGO", comercio: "Pago de tarjeta", categoria: "interno", subcategoria: "Pago de tarjeta" },
  { patron: "PAGO VISA", comercio: "Pago de tarjeta", categoria: "interno", subcategoria: "Pago de tarjeta" },
  { patron: "PAGO MASTERCARD", comercio: "Pago de tarjeta", categoria: "interno", subcategoria: "Pago de tarjeta" },
  { patron: "EXTRACCION", comercio: "Extracción", categoria: "interno", subcategoria: "Extracción de efectivo" },
  { patron: "CAJERO AUTOMATICO", comercio: "Cajero", categoria: "interno", subcategoria: "Extracción de efectivo" },
  { patron: "TRANSFERENCIA", comercio: "Transferencia", categoria: "interno", subcategoria: "Transferencia entre cuentas" },
] as const;

/** Precalculado una sola vez: patrón más específico primero. */
export const SEMILLA_ORDENADA: readonly EntradaSemilla[] = [...SEMILLA].sort(
  (a, b) => b.patron.length - a.patron.length,
);
