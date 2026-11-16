/* Reglas de calidad de las landings. Se editan desde el panel (Reglas). */
window.LANZATE_REGLAS = {
  "textos": {
    "roles": [
      {
        "id": "kicker",
        "max": 32,
        "min": 0,
        "label": "Antetítulo",
        "activo": true,
        "selector": ".nx-kicker, .plan-kicker"
      },
      {
        "id": "faq",
        "max": 90,
        "min": 10,
        "label": "Pregunta frecuente",
        "activo": true,
        "selector": ".accordion-button"
      },
      {
        "id": "hero-titulo",
        "max": 60,
        "min": 10,
        "label": "Título de portada",
        "activo": true,
        "selector": ".nx-hero h1, .nx-hero h2, .nx-hero .nx-display"
      },
      {
        "id": "hero-bajada",
        "max": 150,
        "min": 0,
        "label": "Bajada de portada",
        "activo": true,
        "selector": ".nx-hero p"
      },
      {
        "id": "titulo-seccion",
        "max": 70,
        "min": 4,
        "label": "Título de sección",
        "activo": true,
        "selector": "h1, h2"
      },
      {
        "id": "bajada",
        "max": 180,
        "min": 0,
        "label": "Bajada de sección",
        "activo": true,
        "selector": ".nx-lead"
      },
      {
        "id": "boton",
        "max": 24,
        "min": 2,
        "label": "Botón",
        "activo": true,
        "selector": ".btn-nx, .btn-nx-outline, .btn"
      },
      {
        "id": "menu",
        "max": 18,
        "min": 2,
        "label": "Ítem de menú",
        "activo": true,
        "selector": ".nav-link"
      },
      {
        "id": "titulo-tarjeta",
        "max": 48,
        "min": 3,
        "label": "Título de tarjeta",
        "activo": true,
        "selector": "h3, h4, h5, h6, .h4, .h5, .h6"
      },
      {
        "id": "testimonio",
        "max": 260,
        "min": 0,
        "label": "Testimonio",
        "activo": true,
        "selector": ".quote-card p, blockquote"
      },
      {
        "id": "parrafo",
        "max": 320,
        "min": 0,
        "label": "Párrafo",
        "activo": true,
        "selector": "p"
      }
    ],
    "viudas": true,
    "ejemplos": true,
    "listaEjemplos": [
      "example.com",
      "5491123456789",
      "lorem ipsum",
      "Marca Ejemplo",
      "2345 6789",
      "Calle Ejemplo",
      "Tu marca",
      "Nombre Apellido"
    ]
  },
  "general": {
    "bloquear": true
  },
  "version": 1,
  "imagenes": {
    "roles": [
      {
        "id": "logo",
        "label": "Logo",
        "maxKB": 60,
        "activo": true,
        "minAlto": 80,
        "minAncho": 0,
        "selector": ".nx-brand img, img[alt*='logo' i], img[src*='logo' i]",
        "proporcion": ""
      },
      {
        "id": "avatar",
        "label": "Foto de persona (avatar)",
        "maxKB": 80,
        "activo": true,
        "minAlto": 400,
        "minAncho": 400,
        "selector": ".nx-avatar",
        "proporcion": "1:1"
      },
      {
        "id": "equipo",
        "label": "Foto de equipo",
        "maxKB": 200,
        "activo": true,
        "minAlto": 800,
        "minAncho": 600,
        "selector": ".person-card img",
        "proporcion": ""
      },
      {
        "id": "producto",
        "label": "Foto de producto",
        "maxKB": 250,
        "activo": true,
        "minAlto": 1000,
        "minAncho": 1000,
        "selector": ".prod-card img, .prod-feature img",
        "proporcion": ""
      },
      {
        "id": "galeria",
        "label": "Galería",
        "maxKB": 350,
        "activo": true,
        "minAlto": 0,
        "minAncho": 1600,
        "selector": ".gal-card img, .bento-tile img, .fw-bleed img",
        "proporcion": ""
      },
      {
        "id": "portada",
        "label": "Portada y carrusel",
        "maxKB": 450,
        "activo": true,
        "minAlto": 720,
        "minAncho": 1280,
        "selector": ".nx-hero",
        "proporcion": ""
      },
      {
        "id": "general",
        "label": "Imagen general",
        "maxKB": 300,
        "activo": true,
        "minAlto": 0,
        "minAncho": 1200,
        "selector": "img, [style*='background-image']",
        "proporcion": ""
      }
    ],
    "altMax": 125,
    "nitidez": 1.5,
    "formatos": [
      "webp",
      "avif",
      "jpg",
      "jpeg",
      "png",
      "svg"
    ],
    "altObligatorio": true
  },
  "estructura": {
    "reglas": [
      {
        "id": "inicio-navegacion",
        "label": "Navegación siempre arriba de todo",
        "nivel": "error",
        "activo": true
      },
      {
        "id": "hero-segundo",
        "label": "La portada va justo después de la Navegación",
        "nivel": "error",
        "activo": true
      },
      {
        "id": "fin-footer",
        "label": "Footer siempre al final",
        "nivel": "error",
        "activo": true
      },
      {
        "id": "whatsapp",
        "label": "Incluye el botón de WhatsApp",
        "nivel": "aviso",
        "activo": true
      },
      {
        "id": "sin-repetidos",
        "label": "No repite el mismo tipo de sección",
        "nivel": "aviso",
        "activo": true
      },
      {
        "id": "min-modulos",
        "label": "Cantidad mínima de secciones",
        "nivel": "aviso",
        "valor": 3,
        "activo": true,
        "unidad": "secciones"
      },
      {
        "id": "max-modulos",
        "label": "Cantidad máxima de secciones",
        "nivel": "aviso",
        "valor": 12,
        "activo": true,
        "unidad": "secciones"
      },
      {
        "id": "max-menu",
        "label": "Ítems recomendados en el menú",
        "nivel": "aviso",
        "valor": 3,
        "activo": true,
        "unidad": "ítems"
      },
      {
        "id": "nombre-max",
        "label": "Largo máximo del nombre de la landing",
        "nivel": "aviso",
        "valor": 60,
        "activo": true,
        "unidad": "caracteres"
      }
    ],
    "obligatorios": [
      "navegacion",
      "hero-full-imagen",
      "footer"
    ],
    "nivelObligatorios": "error"
  },
  "actualizado": 1793981172383
};
