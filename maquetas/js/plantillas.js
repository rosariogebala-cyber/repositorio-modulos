/* Las fotos, los textos y los módulos son ejemplos editables de cada rubro. */
window.LanzatePlantillas = [
  {
    id: "belleza", name: "Belleza y moda", match: /belleza|est[eé]tica|barber|peluquer|spa|moda/i,
    templates: [
      { name: "Estudio de estética", style: "Ciruela suave", hero: "compleja", image: ["img/rubros/estetica/hero.jpg", "Profesional realizando un tratamiento facial"],
        title: "Tu piel, en buenas manos", lead: "Tratamientos faciales y corporales con un plan adaptado a tu piel.", action: "Reservá tu turno", target: "booking",
        sections: [
          ["services", "Tratamientos", ["Higiene facial|Limpieza y cuidado según tu tipo de piel.", "Hidratación|Una sesión para pieles que necesitan recuperar confort.", "Masaje facial|Maniobras suaves para aflojar la tensión."], ["droplet", "moisture", "heart"]],
          ["split", "Una atención pensada para vos", "En la primera visita conversamos sobre tus hábitos y el cuidado que buscás.", ["img/rubros/estetica/pro-1.jpg", "Imagen del espacio de estética"]],
          ["booking", "Reservá tu tratamiento", ["Higiene facial", "Hidratación", "Masaje facial"]]
        ] },
      { name: "Barbería de barrio", style: "Grafito", hero: "media", image: ["img/rubros/barberia/hero-1.jpg", "Interior de una barbería"],
        title: "Cortes que van con vos", lead: "Cortes clásicos, fades y barba con cita previa.", action: "Elegí tu horario", target: "booking",
        sections: [
          ["benefits", "Un buen corte empieza con una charla", ["Corte clásico|Definimos largo y textura con vos.", "Fade|Degradado trabajado según tu estilo.", "Barba|Perfilado y terminación.", "Corte y barba|Dos servicios en un mismo turno."], ["scissors", "stars", "person", "calendar-check"]],
          ["gallery", "Conocé la barbería", [
            ["img/rubros/barberia/hero-1.jpg", "Interior de la barbería", "El espacio"],
            ["img/rubros/barberia/hero-2.jpg", "Escena de barbería", "El oficio"],
            ["img/rubros/barberia/hero-3.jpg", "Detalle de barbería", "Los detalles"]]],
          ["booking", "Agendá tu corte", ["Corte clásico", "Fade", "Barba", "Corte y barba"]]
        ] }
    ]
  },
  {
    id: "bienestar", name: "Pilates y bienestar", match: /pilates|yoga|bienestar|fitness|gimnas/i,
    templates: [
      { name: "Pilates Reformer", style: "Salvia", hero: "media", image: ["../Proyectos/portal-studio/img/pilates.jpg", "Clase de pilates con reformer"],
        title: "Movimiento que se adapta a vos", lead: "Clases de Reformer en grupos chicos, con acompañamiento desde la primera sesión.", action: "Reservá una clase", target: "booking",
        sections: [
          ["split", "Entrená en grupos chicos", "Empezamos por conocer cómo te movés y adaptamos los ejercicios a tu nivel.", ["../Proyectos/portal-studio/img/espacio.jpg", "Interior de un estudio de movimiento"]],
          ["booking", "Elegí tu clase de pilates", ["Primera clase", "Reformer inicial", "Reformer intermedio"]]
        ] },
      { name: "Estudio de yoga", style: "Lavanda", hero: "simple", image: ["../Proyectos/portal-studio/img/yoga.jpg", "Práctica de yoga sobre colchoneta"],
        title: "Encontrá tu ritmo en la práctica", lead: "Yoga suave, movilidad y respiración para volver al cuerpo.", action: "Conocé las clases",
        sections: [
          ["services", "Clases y prácticas", ["Yoga suave|Secuencias tranquilas para empezar.", "Movilidad|Ejercicios guiados para ganar amplitud.", "Respiración|Práctica pausada para cerrar el día."], ["moon", "activity", "wind"]],
          ["faq", "Antes de tu primera clase", ["¿Necesito experiencia?|Podés empezar en el grupo inicial.", "¿Qué llevo?|Ropa cómoda, agua y tu colchoneta si ya tenés."]]
        ] }
    ]
  },
  {
    id: "salud", name: "Salud y consultorios", match: /salud|m[eé]dic|cl[ií]nic|odont|consultorio/i,
    templates: [
      { name: "Consultorio odontológico", style: "Azul clínico", hero: "media", image: ["img/plantillas/odontologia.webp", "Profesional en un consultorio odontológico"],
        title: "Cuidá tu sonrisa desde el primer control", lead: "Consultas programadas para prevención, higiene y evaluación odontológica.", action: "Solicitá un turno", target: "booking",
        sections: [["services", "Motivos de consulta", ["Control|Revisión y orientación sobre próximos pasos.", "Higiene|Limpieza profesional con indicaciones de cuidado.", "Evaluación|Una visita para conversar sobre tus necesidades."], ["clipboard2-check", "droplet", "chat-dots"]],
          ["faq", "Prepará tu visita", ["¿Qué llevo al primer turno?|Traé tu documentación y estudios previos si los tenés.", "¿Puedo reprogramar?|Contactá al consultorio para consultar disponibilidad."]],
          ["booking", "Solicitá tu turno", ["Control", "Higiene", "Evaluación"]]] }
    ]
  },
  {
    id: "gastronomia", name: "Gastronomía", match: /gastron|restaur|caf[eé]|panader|pasteler|bistr[oó]/i,
    templates: [
      { name: "Bistró de temporada", style: "Vino y cacao", hero: "compleja", image: ["img/plantillas/bistro.webp", "Plato de pasta servido en una mesa oscura"],
        title: "Una mesa para disfrutar sin apuro", lead: "Cocina de estación, pastas caseras y una carta que cambia con el mercado.", action: "Reservá una mesa", target: "booking",
        sections: [["services", "De la cocina a la mesa", ["Entradas|Verduras de estación para compartir.", "Pastas frescas|Preparaciones hechas en la casa.", "Postres|Clásicos con ingredientes de temporada."], ["basket", "fire", "cup-hot"]],
          ["booking", "Reservá una mesa", ["Almuerzo", "Cena", "Mesa grupal"]]] },
      { name: "Café de especialidad", style: "Café tostado", hero: "simple", image: ["img/plantillas/cafe.webp", "Café y pastelería en una mesa luminosa"],
        title: "Buen café, hecho con tiempo", lead: "Espresso, filtrados y pastelería para disfrutar acá o llevar.", action: "Mirá la carta",
        sections: [["services", "La carta del café", ["Espresso|Clásicos de barra y opciones con leche.", "Filtrados|Preguntá por el origen del día.", "Pastelería|Productos de horno para acompañar."], ["cup-hot", "droplet", "cake2"]],
          ["faq", "Antes de venir", ["¿Preparan café para llevar?|Sí, consultá en la barra.", "¿Hay opciones sin lácteos?|Preguntanos por las bebidas vegetales disponibles."]]] }
    ]
  },
  {
    id: "turismo", name: "Viajes y turismo", match: /viaje|turismo|hotel|excurs/i,
    templates: [
      { name: "Escapadas a la Patagonia", style: "Litoral", hero: "compleja", image: ["img/rubros/viajes/dest-bariloche.webp", "Paisaje patagónico en Bariloche"],
        title: "Unos días al sur cambian el ritmo", lead: "Armá tu viaje entre lagos, senderos y pueblos de montaña.", action: "Explorá los destinos",
        sections: [["products", "Elegí tu escapada", ["Bariloche|Lagos y circuitos de montaña", "Ushuaia|Bosque y costa austral", "Ruta de naturaleza|Paisajes para recorrer al aire libre"],
          [["img/rubros/viajes/dest-bariloche.webp", "Paisaje de Bariloche"], ["img/rubros/viajes/promo-ushuaia.webp", "Paisaje austral de Ushuaia"], ["img/rubros/viajes/cat-naturaleza.webp", "Paisaje natural al aire libre"]]],
          ["process", "Cómo armamos tu itinerario", ["Elegí fechas|Contanos cuándo podés viajar.", "Definí el recorrido|Buscamos actividades según tu ritmo.", "Revisá la propuesta|Te detallamos traslados, alojamiento y excursiones."], ["calendar", "map", "check-circle"]]] },
      { name: "Vacaciones en el Caribe", style: "Petróleo", hero: "media", image: ["img/rubros/viajes/dest-cancun.webp", "Playa en Cancún"],
        title: "Tu próxima pausa queda frente al mar", lead: "Compará destinos del Caribe y encontrá una opción para tu forma de viajar.", action: "Compará destinos",
        sections: [["products", "Destinos de playa", ["Cancún|Playas y excursiones", "Punta Cana|Descanso frente al mar", "Costa y aventura|Actividades al aire libre"],
          [["img/rubros/viajes/dest-cancun.webp", "Playa en Cancún"], ["img/rubros/viajes/promo-puntacana.webp", "Playa en Punta Cana"], ["img/rubros/viajes/cat-aventura.webp", "Escenario para turismo aventura"]]],
          ["faq", "Antes de viajar", ["¿Qué incluye cada paquete?|Los servicios se detallan en la cotización.", "¿Puedo viajar con chicos?|Podés pedir opciones de alojamiento para familias."]]] }
    ]
  },
  {
    id: "inmobiliaria", name: "Inmobiliaria", match: /inmobil|propiedad|bien(?:es)? ra[ií]z|arquitect/i,
    templates: [
      { name: "Propiedades para visitar", style: "Pizarra", hero: "media", image: ["img/rubros/inmobiliaria/hero-1.jpg", "Interior de una propiedad"],
        title: "Encontrá un lugar para tu próxima etapa", lead: "Explorá propiedades y elegí cuáles querés conocer en persona.", action: "Ver propiedades",
        sections: [["products", "Propiedades destacadas", ["Departamento|Ambientes luminosos", "Casa|Espacio para disfrutar en familia", "Unidad moderna|Distribución funcional"],
          [["img/rubros/inmobiliaria/prop-1.jpg", "Primera propiedad del catálogo"], ["img/rubros/inmobiliaria/prop-2.jpg", "Segunda propiedad del catálogo"], ["img/rubros/inmobiliaria/prop-3.jpg", "Tercera propiedad del catálogo"]]],
          ["booking", "Coordiná una visita", ["Departamento", "Casa", "Unidad moderna"]]] },
      { name: "Tasaciones inmobiliarias", style: "Arena", hero: "simple", image: ["img/rubros/inmobiliaria/hero-4.jpg", "Propiedad residencial"],
        title: "Conocé el valor de tu propiedad", lead: "Una tasación para tomar decisiones con referencias claras del mercado.", action: "Conocé el proceso",
        sections: [["process", "De la consulta al informe", ["Reunimos datos|Revisamos ubicación, superficie y estado.", "Comparamos|Buscamos referencias de propiedades similares.", "Presentamos|Te entregamos un rango con sus fundamentos."], ["clipboard", "bar-chart", "file-text"]],
          ["faq", "Consultas sobre tasaciones", ["¿Qué documentación sirve?|Planos, superficie y datos del inmueble.", "¿Se visita la propiedad?|Coordinamos una visita si el alcance lo requiere."]]] }
    ]
  },
  {
    id: "educacion", name: "Educación y libros", match: /educaci[oó]n|idioma|academia|escuela|curso|libro/i,
    templates: [
      { name: "Academia de idiomas", style: "Índigo", hero: "media", image: ["img/rubros/idiomas/hero.jpg", "Clase de idiomas"],
        title: "Hablá otro idioma con más confianza", lead: "Cursos por nivel, práctica de conversación y grupos reducidos.", action: "Ver cursos",
        sections: [["services", "Modalidades de cursada", ["Inicial|Empezá por situaciones cotidianas.", "Conversación|Practicá con temas de tu interés.", "Individual|Trabajá objetivos concretos a tu ritmo."], ["chat", "people", "person-video"]],
          ["process", "Encontrá tu nivel", ["Contanos tu objetivo|Trabajo, viaje o interés personal.", "Evaluá tu punto de partida|Hacemos una breve actividad de nivel.", "Elegí tu grupo|Buscamos una modalidad y horario que te sirvan."], ["flag", "journal-check", "calendar"]]] },
      { name: "Taller de lectura", style: "Azul tinta", hero: "simple", image: ["img/plantillas/lectura.webp", "Libros y cuadernos en una mesa de lectura"],
        title: "Leamos juntos, una historia a la vez", lead: "Encuentros para descubrir autores, intercambiar miradas y recuperar el tiempo de lectura.", action: "Ver próximos encuentros", target: "booking",
        sections: [["services", "Formas de participar", ["Club mensual|Una obra para leer y comentar en grupo.", "Lectura guiada|Fragmentos y contexto en cada encuentro.", "Encuentro abierto|Una primera charla para conocer la dinámica."], ["book", "bookmark", "people"]],
          ["booking", "Elegí un encuentro", ["Club mensual", "Lectura guiada", "Encuentro abierto"]]] }
    ]
  },
  {
    id: "servicios", name: "Negocios y servicios", match: /servicio|consultor|empresa|estudio/i,
    templates: [
      { name: "Consultoría para pymes", style: "Profesional", hero: "compleja", image: ["img/equipo-grupo.jpg", "Equipo de trabajo en una reunión"],
        title: "Ordená tus procesos para crecer", lead: "Diagnóstico, prioridades y un plan de trabajo para el próximo paso de tu empresa.", action: "Conocé la propuesta",
        sections: [["services", "Áreas de trabajo", ["Operaciones|Revisamos tareas y responsabilidades.", "Gestión|Armamos indicadores para seguir avances.", "Planificación|Priorizamos lo que más impacto puede tener."], ["diagram-3", "graph-up", "flag"]],
          ["process", "Así trabajamos", ["Diagnóstico|Escuchamos al equipo y revisamos datos.", "Propuesta|Acordamos prioridades y entregables.", "Seguimiento|Medimos avances y ajustamos el plan."], ["search", "list-check", "graph-up"]]] },
      { name: "Estudio creativo", style: "Cobre", hero: "media", image: ["img/servicio-web.jpg", "Espacio de trabajo creativo"],
        title: "Una identidad que se reconoce", lead: "Diseño de marca y piezas digitales para negocios con una historia propia.", action: "Ver servicios",
        sections: [["benefits", "Diseño para cada etapa", ["Identidad|Sistema visual y pautas de uso.", "Campañas|Piezas adaptadas a cada formato.", "Dirección de arte|Criterios visuales para fotos y contenido.", "Implementación|Archivos listos para el equipo."], ["palette", "megaphone", "image", "folder"]],
          ["faq", "Antes de empezar", ["¿Qué necesitan para cotizar?|Un objetivo y una idea de las piezas que necesitás.", "¿Entregan archivos editables?|Acordamos los formatos al definir el alcance."]]] }
    ]
  },
  {
    id: "mascotas", name: "Animales y mascotas", match: /mascota|veterin|animal/i,
    templates: [{ name: "Veterinaria de barrio", style: "Menta", hero: "media", image: ["img/plantillas/mascotas.webp", "Veterinaria examinando a un perro"],
      title: "Cuidado cercano para tu mascota", lead: "Consultas programadas, controles y orientación para cada etapa.", action: "Pedí un turno", target: "booking",
      sections: [["services", "Servicios veterinarios", ["Control|Evaluación general y seguimiento.", "Vacunación|Revisión del esquema según edad y antecedentes.", "Orientación|Consultas sobre alimentación y cuidado cotidiano."], ["clipboard2-pulse", "shield-check", "heart"]],
        ["booking", "Solicitá un turno", ["Control", "Vacunación", "Orientación"]]] }]
  },
  {
    id: "automotor", name: "Autos y motos", match: /auto|moto|mec[aá]nic/i,
    templates: [{ name: "Taller mecánico", style: "Grafito", hero: "compleja", image: ["img/plantillas/automotor.webp", "Mecánico trabajando en un automóvil"],
      title: "Tu auto, listo para volver al camino", lead: "Diagnóstico y mantenimiento con presupuesto antes de intervenir.", action: "Agendá una revisión", target: "booking",
      sections: [["services", "Servicios de taller", ["Service|Aceite, filtros y revisión preventiva.", "Frenos|Inspección de discos, pastillas y líquido.", "Diagnóstico|Revisión según los síntomas del vehículo."], ["tools", "disc", "speedometer"]],
        ["booking", "Agendá una revisión", ["Service", "Frenos", "Diagnóstico"]]] }]
  },
  {
    id: "fotografia", name: "Diseño y fotografía", match: /fot[oó]graf|dise[nñ]o/i,
    templates: [{ name: "Fotografía de estudio", style: "Topo", hero: "simple", image: ["img/plantillas/fotografia.webp", "Fotógrafa trabajando en un estudio luminoso"],
      title: "Fotos para contar lo que hacés", lead: "Retratos profesionales, productos y campañas con dirección de arte.", action: "Ver tipos de sesión",
      sections: [["services", "Sesiones disponibles", ["Retratos|Imágenes para perfiles y equipos.", "Producto|Fotografía para catálogo y campañas.", "Editorial|Producción pensada para una historia visual."], ["person-bounding-box", "box-seam", "camera"]],
        ["process", "De la idea a la entrega", ["Brief|Definimos objetivo y referencias.", "Sesión|Trabajamos luz, encuadre y dirección.", "Selección|Elegís las tomas para edición final."], ["clipboard", "camera", "images"]]] }]
  },
  {
    id: "cultura", name: "Arte y cultura", match: /galer[ií]a|museo|arte|cultura/i,
    templates: [{ name: "Galería de arte", style: "Berenjena", hero: "media", image: ["img/plantillas/cultura.webp", "Visitante frente a obras en una galería"],
      title: "El arte se encuentra en persona", lead: "Exposiciones, recorridos y conversaciones para descubrir nuevas miradas.", action: "Ver la programación",
      sections: [["services", "Programación de la galería", ["Muestra actual|Obras de la temporada en sala.", "Visita guiada|Recorrido con contexto sobre las piezas.", "Encuentro con artistas|Conversaciones sobre procesos de trabajo."], ["image", "signpost", "chat"]],
        ["faq", "Organizá tu visita", ["¿Hay visitas en grupo?|Consultá fechas para grupos y escuelas.", "¿Puedo sacar fotos?|La sala indica las condiciones de cada muestra."]]] }]
  },
  {
    id: "electronica", name: "Electrónica", match: /electr[oó]nica|audio|accesorios/i,
    templates: [{ name: "Audio y accesorios", style: "Azul eléctrico", hero: "compleja", image: ["img/plantillas/electronica.webp", "Auriculares y accesorios electrónicos sobre un escritorio"],
      title: "Equipá tu día con lo que realmente usás", lead: "Audio y accesorios elegidos para trabajar, estudiar y escuchar música.", action: "Ver categorías",
      sections: [["benefits", "Qué podés encontrar", ["Auriculares|Alternativas para oficina y uso diario.", "Parlantes|Opciones compactas para llevar.", "Cables|Conexiones para distintos equipos.", "Asesoramiento|Consultá compatibilidad antes de elegir."], ["headphones", "speaker", "usb-symbol", "chat-dots"]],
        ["faq", "Consultas de compra", ["¿Cómo verifico la compatibilidad?|Mandanos el modelo de tu dispositivo.", "¿Puedo retirar mi pedido?|Consultá opciones de retiro y envío."]]] }]
  },
  {
    id: "hogar", name: "Hogar y familia", match: /hogar|familia|electric|mantenimiento/i,
    templates: [{ name: "Electricidad para el hogar", style: "Canela", hero: "media", image: ["img/plantillas/hogar.webp", "Electricista trabajando en una vivienda"],
      title: "Instalaciones eléctricas para tu casa", lead: "Revisión, diagnóstico y reparaciones coordinadas con presupuesto previo.", action: "Ver servicios",
      sections: [["services", "Trabajos a domicilio", ["Iluminación|Instalación y renovación de luminarias.", "Tableros|Revisión y actualización según el estado de la instalación.", "Diagnóstico|Evaluamos la falla y te explicamos las opciones."], ["lightbulb", "lightning", "search"]],
        ["process", "Cómo coordinamos la visita", ["Consultá|Contanos el trabajo y en qué zona estás.", "Agendá|Acordamos una franja para evaluar el trabajo.", "Revisá el presupuesto|Definimos el alcance antes de comenzar."], ["chat", "calendar", "clipboard-check"]]] }]
  },
  {
    id: "regalos", name: "Regalos y flores", match: /regalo|flor|fiesta/i,
    templates: [{ name: "Florería de estación", style: "Frambuesa", hero: "simple", image: ["img/plantillas/regalos.webp", "Florista preparando un ramo de flores"],
      title: "Flores para decirlo a tu manera", lead: "Ramos por encargo, arreglos para eventos y regalos con dedicatoria.", action: "Ver opciones",
      sections: [["services", "Arreglos y encargos", ["Ramos|Combinaciones con flores disponibles de estación.", "Eventos|Arreglos para mesas y celebraciones.", "Regalos|Ramos con tarjeta y coordinación de entrega."], ["flower1", "calendar-event", "gift"]],
        ["faq", "Cómo hacer tu pedido", ["¿Puedo elegir los colores?|Sí, según la disponibilidad de la semana.", "¿Con cuánto tiempo encargo?|Consultá disponibilidad para la fecha que necesitás."]]] }]
  },
  {
    id: "comunidad", name: "Sociedad y comunidad", match: /comunidad|fundaci[oó]n|ong|social/i,
    templates: [{ name: "Red de voluntariado", style: "Eucalipto", hero: "media", image: ["img/plantillas/comunidad.webp", "Personas voluntarias clasificando donaciones"],
      title: "Sumá tiempo a una causa cercana", lead: "Conectamos personas y organizaciones para sostener acciones en el barrio.", action: "Cómo participar",
      sections: [["process", "Cómo sumarte", ["Elegí una actividad|Encontrá una tarea según tus intereses.", "Coordiná tu primera jornada|Acordamos el horario y lo que necesitás llevar.", "Participá con el equipo|Te acompañamos para conocer la dinámica."], ["heart", "calendar", "people"]],
        ["faq", "Preguntas de voluntariado", ["¿Necesito experiencia?|Cada actividad indica qué preparación requiere.", "¿Puedo participar en familia?|Consultá las edades admitidas para cada jornada."]]] }]
  },
  {
    id: "tecnologia", name: "Computación e internet", match: /tecnolog|software|internet|sistemas/i,
    templates: [{ name: "Software para equipos", style: "Azul eléctrico", hero: "compleja", image: ["img/plantillas/tecnologia.webp", "Desarrollador trabajando frente a una computadora"],
      title: "Organizá el trabajo en un solo lugar", lead: "Una plataforma para centralizar tareas, responsables y avances del equipo.", action: "Conocé las funciones",
      sections: [["benefits", "Funciones para el día a día", ["Tableros|Ordená pendientes por etapa.", "Responsables|Asigná tareas y fechas.", "Reportes|Revisá el avance semanal.", "Permisos|Definí qué puede ver cada rol."], ["kanban", "person-check", "bar-chart", "shield-lock"]],
        ["process", "Así empezás", ["Creá un espacio|Configurá tu primer proyecto.", "Invitá al equipo|Definí accesos y responsables.", "Seguí avances|Revisá el tablero con el equipo."], ["plus-square", "people", "graph-up"]]] }]
  },
  {
    id: "deportes", name: "Deportes y aire libre", match: /deporte|aire libre|trekking|running/i,
    templates: [{ name: "Club de trekking", style: "Bosque", hero: "simple", image: ["img/rubros/viajes/cat-aventura.webp", "Paisaje para actividades de aventura"],
      title: "La próxima caminata empieza acá", lead: "Salidas guiadas para conocer senderos y compartir el recorrido.", action: "Ver niveles",
      sections: [["services", "Salidas por nivel", ["Inicial|Recorrido corto con paradas programadas.", "Intermedio|Caminata con desnivel y mayor distancia.", "Jornada completa|Circuito largo con requisitos de preparación."], ["signpost", "geo-alt", "map"]],
        ["booking", "Anotate a una salida", ["Inicial", "Intermedio", "Jornada completa"]]] }]
  },
  {
    id: "entretenimiento", name: "Entretenimiento y vida nocturna", match: /entretenimiento|m[uú]sica|evento|juego|nocturn/i,
    templates: [{ name: "Ciclo de música en vivo", style: "Berenjena", hero: "compleja", image: ["img/plantillas/entretenimiento.webp", "Escenario de un concierto con luces azules y violetas"],
      title: "Una noche para escuchar en vivo", lead: "Artistas emergentes, sesiones acústicas y fechas para agendar.", action: "Ver programación",
      sections: [["services", "Programación del ciclo", ["Acústicos|Formatos íntimos con público cerca.", "Bandas invitadas|Nuevas propuestas en el escenario.", "Sesiones especiales|Encuentros con cruces de géneros."], ["music-note", "soundwave", "stars"]],
        ["faq", "Antes del show", ["¿A qué hora abren las puertas?|El horario se informa en cada fecha.", "¿Cómo reservo mi lugar?|Consultá el canal de reservas del evento."]]] }]
  }
];
