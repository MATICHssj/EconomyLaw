/**
 * Diccionario mexicano de comercios y palabras clave → categoría.
 * Todo en minúsculas y SIN acentos (se compara contra texto normalizado).
 */

export interface MerchantInfo {
  name: string;
  categoryId: string;
}

/** Comercios conocidos (frases de 1 a 3 palabras). Las frases más largas ganan. */
export const MERCHANTS: Record<string, MerchantInfo> = {
  // Tiendas de conveniencia
  oxxo: { name: 'OXXO', categoryId: 'snacks' },
  '7 eleven': { name: '7-Eleven', categoryId: 'snacks' },
  '7eleven': { name: '7-Eleven', categoryId: 'snacks' },
  '7-eleven': { name: '7-Eleven', categoryId: 'snacks' },
  seven: { name: '7-Eleven', categoryId: 'snacks' },
  'circle k': { name: 'Circle K', categoryId: 'snacks' },
  kiosko: { name: 'Kiosko', categoryId: 'snacks' },
  'tienda extra': { name: 'Extra', categoryId: 'snacks' },
  // Súper
  walmart: { name: 'Walmart', categoryId: 'groceries' },
  'bodega aurrera': { name: 'Bodega Aurrera', categoryId: 'groceries' },
  aurrera: { name: 'Bodega Aurrera', categoryId: 'groceries' },
  soriana: { name: 'Soriana', categoryId: 'groceries' },
  chedraui: { name: 'Chedraui', categoryId: 'groceries' },
  'la comer': { name: 'La Comer', categoryId: 'groceries' },
  'fresko': { name: 'Fresko', categoryId: 'groceries' },
  'city market': { name: 'City Market', categoryId: 'groceries' },
  superama: { name: 'Superama', categoryId: 'groceries' },
  costco: { name: 'Costco', categoryId: 'groceries' },
  sams: { name: "Sam's Club", categoryId: 'groceries' },
  "sam's": { name: "Sam's Club", categoryId: 'groceries' },
  heb: { name: 'HEB', categoryId: 'groceries' },
  'casa ley': { name: 'Casa Ley', categoryId: 'groceries' },
  'mi bodega': { name: 'Mi Bodega Aurrera', categoryId: 'groceries' },
  '3b': { name: 'Tiendas 3B', categoryId: 'groceries' },
  'tiendas 3b': { name: 'Tiendas 3B', categoryId: 'groceries' },
  neto: { name: 'Tiendas Neto', categoryId: 'groceries' },
  // Transporte
  uber: { name: 'Uber', categoryId: 'transport' },
  didi: { name: 'DiDi', categoryId: 'transport' },
  cabify: { name: 'Cabify', categoryId: 'transport' },
  indriver: { name: 'inDrive', categoryId: 'transport' },
  indrive: { name: 'inDrive', categoryId: 'transport' },
  bolt: { name: 'Bolt', categoryId: 'transport' },
  metrobus: { name: 'Metrobús', categoryId: 'transport' },
  ado: { name: 'ADO', categoryId: 'transport' },
  etn: { name: 'ETN', categoryId: 'transport' },
  ecobici: { name: 'Ecobici', categoryId: 'transport' },
  iave: { name: 'IAVE', categoryId: 'transport' },
  televia: { name: 'TeleVía', categoryId: 'transport' },
  // Comida a domicilio
  rappi: { name: 'Rappi', categoryId: 'delivery' },
  'uber eats': { name: 'Uber Eats', categoryId: 'delivery' },
  'didi food': { name: 'DiDi Food', categoryId: 'delivery' },
  // Gasolina
  pemex: { name: 'Pemex', categoryId: 'gas' },
  g500: { name: 'G500', categoryId: 'gas' },
  'oxxo gas': { name: 'Oxxo Gas', categoryId: 'gas' },
  shell: { name: 'Shell', categoryId: 'gas' },
  mobil: { name: 'Mobil', categoryId: 'gas' },
  arco: { name: 'Arco', categoryId: 'gas' },
  // Servicios
  cfe: { name: 'CFE', categoryId: 'utilities' },
  telmex: { name: 'Telmex', categoryId: 'utilities' },
  telcel: { name: 'Telcel', categoryId: 'utilities' },
  'at&t': { name: 'AT&T', categoryId: 'utilities' },
  att: { name: 'AT&T', categoryId: 'utilities' },
  movistar: { name: 'Movistar', categoryId: 'utilities' },
  bait: { name: 'Bait', categoryId: 'utilities' },
  izzi: { name: 'izzi', categoryId: 'utilities' },
  totalplay: { name: 'Totalplay', categoryId: 'utilities' },
  megacable: { name: 'Megacable', categoryId: 'utilities' },
  sky: { name: 'SKY', categoryId: 'utilities' },
  dish: { name: 'Dish', categoryId: 'utilities' },
  naturgy: { name: 'Naturgy', categoryId: 'utilities' },
  // Suscripciones
  netflix: { name: 'Netflix', categoryId: 'subscriptions' },
  spotify: { name: 'Spotify', categoryId: 'subscriptions' },
  'disney+': { name: 'Disney+', categoryId: 'subscriptions' },
  disney: { name: 'Disney+', categoryId: 'subscriptions' },
  hbo: { name: 'HBO Max', categoryId: 'subscriptions' },
  'hbo max': { name: 'HBO Max', categoryId: 'subscriptions' },
  'prime video': { name: 'Prime Video', categoryId: 'subscriptions' },
  'amazon prime': { name: 'Amazon Prime', categoryId: 'subscriptions' },
  'youtube premium': { name: 'YouTube Premium', categoryId: 'subscriptions' },
  'apple music': { name: 'Apple Music', categoryId: 'subscriptions' },
  icloud: { name: 'iCloud', categoryId: 'subscriptions' },
  'google one': { name: 'Google One', categoryId: 'subscriptions' },
  chatgpt: { name: 'ChatGPT', categoryId: 'subscriptions' },
  claude: { name: 'Claude', categoryId: 'subscriptions' },
  crunchyroll: { name: 'Crunchyroll', categoryId: 'subscriptions' },
  vix: { name: 'ViX', categoryId: 'subscriptions' },
  'paramount+': { name: 'Paramount+', categoryId: 'subscriptions' },
  paramount: { name: 'Paramount+', categoryId: 'subscriptions' },
  'game pass': { name: 'Xbox Game Pass', categoryId: 'subscriptions' },
  'ps plus': { name: 'PlayStation Plus', categoryId: 'subscriptions' },
  canva: { name: 'Canva', categoryId: 'subscriptions' },
  // Compras
  amazon: { name: 'Amazon', categoryId: 'shopping' },
  'mercado libre': { name: 'Mercado Libre', categoryId: 'shopping' },
  mercadolibre: { name: 'Mercado Libre', categoryId: 'shopping' },
  meli: { name: 'Mercado Libre', categoryId: 'shopping' },
  shein: { name: 'Shein', categoryId: 'clothing' },
  temu: { name: 'Temu', categoryId: 'shopping' },
  liverpool: { name: 'Liverpool', categoryId: 'shopping' },
  'palacio de hierro': { name: 'El Palacio de Hierro', categoryId: 'shopping' },
  sears: { name: 'Sears', categoryId: 'shopping' },
  coppel: { name: 'Coppel', categoryId: 'shopping' },
  elektra: { name: 'Elektra', categoryId: 'shopping' },
  suburbia: { name: 'Suburbia', categoryId: 'clothing' },
  sanborns: { name: 'Sanborns', categoryId: 'food' },
  'best buy': { name: 'Best Buy', categoryId: 'shopping' },
  steren: { name: 'Steren', categoryId: 'shopping' },
  'office depot': { name: 'Office Depot', categoryId: 'shopping' },
  zara: { name: 'Zara', categoryId: 'clothing' },
  'h&m': { name: 'H&M', categoryId: 'clothing' },
  'c&a': { name: 'C&A', categoryId: 'clothing' },
  'pull and bear': { name: 'Pull&Bear', categoryId: 'clothing' },
  bershka: { name: 'Bershka', categoryId: 'clothing' },
  innovasport: { name: 'Innovasport', categoryId: 'clothing' },
  'price shoes': { name: 'Price Shoes', categoryId: 'clothing' },
  'home depot': { name: 'The Home Depot', categoryId: 'home' },
  sodimac: { name: 'Sodimac', categoryId: 'home' },
  ikea: { name: 'IKEA', categoryId: 'home' },
  comex: { name: 'Comex', categoryId: 'home' },
  // Comida
  starbucks: { name: 'Starbucks', categoryId: 'coffee' },
  'punta del cielo': { name: 'Punta del Cielo', categoryId: 'coffee' },
  'italian coffee': { name: 'The Italian Coffee', categoryId: 'coffee' },
  'cafe andatti': { name: 'Andatti', categoryId: 'coffee' },
  vips: { name: 'Vips', categoryId: 'food' },
  toks: { name: 'Toks', categoryId: 'food' },
  dominos: { name: "Domino's", categoryId: 'food' },
  "domino's": { name: "Domino's", categoryId: 'food' },
  'little caesars': { name: 'Little Caesars', categoryId: 'food' },
  kfc: { name: 'KFC', categoryId: 'food' },
  mcdonalds: { name: "McDonald's", categoryId: 'food' },
  "mcdonald's": { name: "McDonald's", categoryId: 'food' },
  mcdonald: { name: "McDonald's", categoryId: 'food' },
  'burger king': { name: 'Burger King', categoryId: 'food' },
  'carls jr': { name: "Carl's Jr.", categoryId: 'food' },
  subway: { name: 'Subway', categoryId: 'food' },
  wingstop: { name: 'Wingstop', categoryId: 'food' },
  'el porton': { name: 'El Portón', categoryId: 'food' },
  'la casa de toño': { name: 'La Casa de Toño', categoryId: 'food' },
  'la casa de tono': { name: 'La Casa de Toño', categoryId: 'food' },
  // Salud
  'farmacias guadalajara': { name: 'Farmacias Guadalajara', categoryId: 'health' },
  'farmacia guadalajara': { name: 'Farmacias Guadalajara', categoryId: 'health' },
  'farmacia del ahorro': { name: 'Farmacias del Ahorro', categoryId: 'health' },
  'farmacias del ahorro': { name: 'Farmacias del Ahorro', categoryId: 'health' },
  benavides: { name: 'Farmacias Benavides', categoryId: 'health' },
  'san pablo': { name: 'Farmacia San Pablo', categoryId: 'health' },
  similares: { name: 'Farmacias Similares', categoryId: 'health' },
  simi: { name: 'Farmacias Similares', categoryId: 'health' },
  'dr simi': { name: 'Farmacias Similares', categoryId: 'health' },
  // Entretenimiento
  cinepolis: { name: 'Cinépolis', categoryId: 'entertainment' },
  cinemex: { name: 'Cinemex', categoryId: 'entertainment' },
  ticketmaster: { name: 'Ticketmaster', categoryId: 'entertainment' },
  steam: { name: 'Steam', categoryId: 'entertainment' },
  playstation: { name: 'PlayStation', categoryId: 'entertainment' },
  nintendo: { name: 'Nintendo', categoryId: 'entertainment' },
  // Deporte
  'smart fit': { name: 'Smart Fit', categoryId: 'sports' },
  smartfit: { name: 'Smart Fit', categoryId: 'sports' },
  'sports world': { name: 'Sports World', categoryId: 'sports' },
  // Viajes
  aeromexico: { name: 'Aeroméxico', categoryId: 'travel' },
  volaris: { name: 'Volaris', categoryId: 'travel' },
  'viva aerobus': { name: 'Viva Aerobus', categoryId: 'travel' },
  vivaaerobus: { name: 'Viva Aerobus', categoryId: 'travel' },
  airbnb: { name: 'Airbnb', categoryId: 'travel' },
  booking: { name: 'Booking', categoryId: 'travel' },
  // Mascotas
  petco: { name: 'Petco', categoryId: 'pets' },
  '+kota': { name: '+Kota', categoryId: 'pets' },
  maskota: { name: '+Kota', categoryId: 'pets' },
  // Gobierno
  sat: { name: 'SAT', categoryId: 'taxes' },
  imss: { name: 'IMSS', categoryId: 'health' },
};

/** Palabras clave → categoría. Incluye singulares; los plurales se resuelven quitando la "s". */
export const KEYWORDS: Record<string, string[]> = {
  snacks: [
    'galleta', 'galletas', 'tiendita', 'tienda', 'abarrotes', 'papas', 'papitas', 'sabritas', 'refresco', 'refresco',
    'chesco', 'coca', 'cocacola', 'pepsi', 'chicle', 'chicles', 'dulce', 'dulces', 'chocolate', 'botana', 'botanas',
    'agua', 'gansito', 'helado', 'nieve', 'paleta', 'paletas', 'pan dulce', 'pan', 'chips', 'cacahuates', 'mazapan',
    'snack', 'antojo', 'antojito', 'golosinas', 'jugo', 'yogurt', 'gomitas', 'takis', 'doritos', 'electrolit', 'gatorade',
  ],
  coffee: ['cafe', 'cafecito', 'americano', 'latte', 'capuchino', 'cappuccino', 'frappe', 'espresso', 'expresso', 'mocha', 'chai', 'matcha'],
  food: [
    'tacos', 'taco', 'comida', 'almuerzo', 'desayuno', 'cena', 'comer', 'restaurante', 'restaurant', 'torta', 'tortas',
    'tamal', 'tamales', 'quesadilla', 'quesadillas', 'pizza', 'hamburguesa', 'hamburguesas', 'burger', 'sushi', 'pozole',
    'birria', 'menudo', 'gorditas', 'gordita', 'pambazo', 'tlayuda', 'elote', 'esquites', 'mariscos', 'ceviche',
    'comida corrida', 'fonda', 'alitas', 'boneless', 'hot dog', 'hotdog', 'burrito', 'chilaquiles', 'enchiladas',
    'flautas', 'sopes', 'huaraches', 'carnitas', 'barbacoa', 'rosticeria', 'pollo asado', 'cocina economica', 'lonche',
    'brunch', 'buffet', 'tortas ahogadas', 'pastes', 'tostadas', 'cochinita', 'guajolota', 'churros', 'crepas', 'ramen',
    'comida china', 'pasteleria', 'pastel', 'postre',
  ],
  groceries: [
    'super', 'supermercado', 'despensa', 'mandado', 'verdura', 'verduras', 'fruta', 'frutas', 'carne', 'carniceria',
    'huevo', 'huevos', 'leche', 'tortillas', 'tortilla', 'tortilleria', 'mercado', 'tianguis', 'pollo', 'queso', 'jamon',
    'arroz', 'frijol', 'frijoles', 'aceite de cocina', 'garrafon', 'despensa semanal', 'recaudo', 'cremeria', 'polleria',
  ],
  delivery: ['a domicilio', 'domicilio', 'delivery', 'pedido'],
  transport: [
    'taxi', 'camion', 'combi', 'micro', 'pesero', 'metro', 'tren', 'pasaje', 'pasajes', 'estacionamiento', 'parking',
    'caseta', 'casetas', 'peaje', 'autobus', 'transporte', 'viaje en uber', 'mototaxi', 'bicitaxi', 'tren ligero', 'suburbano',
    'mexibus', 'cablebus', 'trolebus', 'tarjeta del metro', 'tarjeta de movilidad',
  ],
  gas: ['gasolina', 'gasolinera', 'magna', 'premium', 'diesel', 'llenar el tanque', 'tanque', 'gas del carro', 'gas del coche', 'combustible'],
  car: [
    'mecanico', 'taller', 'llanta', 'llantas', 'afinacion', 'verificacion', 'tenencia', 'refrendo', 'seguro del auto',
    'seguro del carro', 'seguro de auto', 'lavado', 'autolavado', 'aceite', 'refacciones', 'refaccion', 'multa', 'grua',
    'carro', 'coche', 'auto', 'balanceo', 'alineacion', 'hojalateria', 'placas', 'licencia de manejo',
  ],
  housing: ['renta', 'alquiler', 'hipoteca', 'mantenimiento', 'predial', 'condominio', 'cuota de mantenimiento', 'infonavit', 'fovissste'],
  utilities: [
    'luz', 'agua potable', 'recibo de agua', 'gas', 'gas lp', 'tanque de gas', 'pipa', 'internet', 'telefono', 'celular',
    'recarga', 'recargas', 'plan', 'plan celular', 'cable', 'servicios', 'recibo',
  ],
  subscriptions: ['suscripcion', 'suscripciones', 'membresia', 'streaming', 'mensualidad app', 'apple', 'youtube', 'prime', 'max'],
  health: [
    'farmacia', 'medicina', 'medicinas', 'medicamento', 'medicamentos', 'doctor', 'doctora', 'medico', 'consulta',
    'dentista', 'hospital', 'analisis', 'laboratorio', 'psicologo', 'psicologa', 'terapia', 'lentes', 'optica', 'vacuna',
    'pastillas', 'nutriologo', 'nutriologa', 'ginecologo', 'pediatra', 'urgencias', 'radiografia', 'ultrasonido',
    'vitaminas', 'curitas', 'paracetamol', 'ibuprofeno',
  ],
  education: [
    'colegiatura', 'colegiaturas', 'escuela', 'inscripcion', 'reinscripcion', 'curso', 'clase', 'clases', 'libro',
    'libros', 'utiles', 'uniforme', 'uniformes', 'universidad', 'diplomado', 'maestria', 'ingles', 'idiomas', 'platzi',
    'udemy', 'coursera', 'tutor', 'tutoria', 'examen',
  ],
  kids: ['panales', 'formula', 'juguete', 'juguetes', 'guarderia', 'bebe', 'nina', 'nino', 'hijos', 'cumple del nino'],
  pets: ['veterinario', 'veterinaria', 'croquetas', 'perro', 'gato', 'mascota', 'vet', 'arena para gato', 'estetica canina'],
  clothing: [
    'ropa', 'zapatos', 'tenis', 'playera', 'playeras', 'camisa', 'pantalon', 'pantalones', 'vestido', 'chamarra',
    'calcetines', 'sudadera', 'jeans', 'zapateria', 'blusa', 'falda', 'shorts', 'gorra', 'bolsa', 'cinturon', 'pijama',
    'calzones', 'brasier', 'botas', 'sandalias', 'chanclas',
  ],
  shopping: [
    'compras', 'compra', 'electronica', 'audifonos', 'cargador', 'funda', 'gadget', 'tienda departamental', 'tv',
    'television', 'pantalla', 'refri', 'refrigerador', 'lavadora', 'secadora', 'estufa', 'microondas', 'licuadora',
    'laptop', 'computadora', 'compu', 'iphone', 'tablet', 'ipad', 'consola', 'bocina', 'smartwatch', 'impresora',
  ],
  home: [
    'muebles', 'mueble', 'limpieza', 'detergente', 'jabon', 'cloro', 'suavitel', 'ferreteria', 'plomero', 'electricista',
    'foco', 'focos', 'sabanas', 'toallas', 'colchon', 'trastes', 'cortinas', 'pintura', 'tlapaleria', 'papel de bano',
    'papel higienico', 'escoba', 'trapeador', 'fabuloso', 'lavanderia', 'tintoreria', 'senora de la limpieza', 'muchacha',
    'jardinero', 'cerrajero',
  ],
  entertainment: [
    'cine', 'pelicula', 'concierto', 'teatro', 'boletos', 'boleto', 'videojuego', 'videojuegos', 'juego', 'museo',
    'feria', 'boliche', 'karaoke', 'estadio', 'partido', 'futbol', 'palomitas', 'parque', 'six flags', 'zoologico',
    'escape room', 'billar', 'arcade', 'xbox', 'switch',
  ],
  alcohol: [
    'cerveza', 'cervezas', 'chela', 'chelas', 'cheve', 'cheves', 'caguama', 'caguamas', 'vino', 'tequila', 'mezcal',
    'licor', 'pisto', 'bar', 'antro', 'cantina', 'six', 'cubas', 'michelada', 'micheladas', 'whisky', 'ron', 'vodka',
    'pulque', 'drinks', 'tragos', 'botella', 'peda', 'fiesta',
  ],
  travel: ['hotel', 'vuelo', 'avion', 'hospedaje', 'viaje', 'vacaciones', 'maleta', 'playa', 'hostal', 'tour', 'excursion', 'equipaje'],
  personal_care: [
    'corte', 'corte de pelo', 'corte de cabello', 'peluqueria', 'barberia', 'barbero', 'estetica', 'unas', 'manicure',
    'pedicure', 'maquillaje', 'perfume', 'shampoo', 'champu', 'crema', 'desodorante', 'rastrillo', 'depilacion', 'spa',
    'masaje', 'tinte', 'cosmeticos', 'skincare', 'pestanas', 'cejas',
  ],
  sports: ['gym', 'gimnasio', 'natacion', 'yoga', 'crossfit', 'proteina', 'deportes', 'pilates', 'box', 'spinning', 'clase de baile', 'zumba'],
  gifts: ['regalo', 'regalos', 'intercambio', 'detalle', 'flores', 'globos'],
  donations: ['donativo', 'donacion', 'limosna', 'ofrenda', 'iglesia', 'diezmo', 'cruz roja', 'teleton', 'caridad'],
  taxes: ['impuesto', 'impuestos', 'tramite', 'acta', 'pasaporte', 'notario', 'declaracion', 'isr', 'contador'],
  debt_costs: ['comision', 'comisiones', 'intereses', 'anualidad', 'cargo por pago tardio', 'penalizacion', 'recargo'],
  business: ['negocio', 'proveedor', 'mercancia', 'insumos', 'inventario', 'material'],
  savings: ['ahorro', 'alcancia', 'cochinito'],
  investments: ['inversion', 'invertir'],
  // ——— Ingresos ———
  salary: ['quincena', 'sueldo', 'nomina', 'salario', 'pago semanal', 'raya', 'me pagaron', 'me depositaron'],
  bonus: ['aguinaldo', 'bono', 'ptu', 'utilidades', 'prima vacacional', 'fondo de ahorro', 'comisiones de venta'],
  freelance: ['freelance', 'honorarios', 'proyecto', 'cliente', 'chamba', 'trabajito', 'jale'],
  sales: ['venta', 'ventas', 'vendi'],
  returns: ['rendimiento', 'rendimientos', 'dividendos', 'intereses ganados'],
  refunds: ['reembolso', 'devolucion', 'cashback', 'me regresaron', 'me devolvieron', 'bonificacion'],
  gifts_received: ['me regalaron', 'regalo de'],
};

/** Categorías de ingreso (el resto son de gasto). */
export const INCOME_CATEGORIES = new Set(['salary', 'bonus', 'freelance', 'sales', 'returns', 'refunds', 'gifts_received', 'tanda_payout', 'other_income']);

/** Emojis que también indican categoría. */
export const EMOJI_CATEGORIES: Record<string, string> = {
  '🌮': 'food', '🍕': 'food', '🍔': 'food', '🍣': 'food', '🌯': 'food', '🍜': 'food', '🥪': 'food', '🍗': 'food',
  '☕': 'coffee', '🍪': 'snacks', '🍫': 'snacks', '🍬': 'snacks', '🥤': 'snacks', '🍦': 'snacks',
  '⛽': 'gas', '🚕': 'transport', '🚌': 'transport', '🚇': 'transport', '🚗': 'car', '🛒': 'groceries',
  '💊': 'health', '🏥': 'health', '🎬': 'entertainment', '🎮': 'entertainment', '🍺': 'alcohol', '🍻': 'alcohol',
  '🍷': 'alcohol', '✈️': 'travel', '🏨': 'travel', '👕': 'clothing', '👟': 'clothing', '🐶': 'pets', '🐱': 'pets',
  '🎁': 'gifts', '💇': 'personal_care', '🏋️': 'sports', '📺': 'subscriptions', '💡': 'utilities', '🏠': 'housing',
};

/** Palabras que no aportan a la descripción cuando quedan sueltas en los extremos. */
export const STOPWORDS = new Set([
  'de', 'del', 'en', 'con', 'por', 'para', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'a', 'al', 'que',
  'me', 'mi', 'mis', 'le', 'les', 'se', 'lo', 'su', 'sus', 'gaste', 'gasté', 'pague', 'pagué', 'compre', 'compré', 'fue',
  'fueron', 'son', 'es', 'pesos', 'peso', 'varos', 'baros', 'mxn', 'total', 'hoy', 'o', 'e',
]);

/** Palabras genéricas: cuentan menos al decidir la categoría. */
export const GENERIC_KEYWORDS = new Set(['compra', 'compras', 'pedido', 'servicios', 'recibo', 'plan', 'tienda', 'carro', 'coche', 'auto', 'comida', 'pago', 'cliente', 'proyecto', 'juego', 'parque', 'detalle', 'material', 'bolsa', 'crema', 'corte', 'apple', 'prime', 'max', 'youtube', 'agua', 'pan', 'pollo', 'mercado']);

/** Siglas que se muestran en mayúsculas en la descripción. */
export const ACRONYMS = new Set(['tv', 'cfe', 'sat', 'imss', 'oxxo', 'ado', 'gbm', 'spei', 'ptu', 'ppr', 'hbo', 'dhl', 'atm', 'usb', 'cetes', 'issste', 'rfc', 'curp', 'ine']);
