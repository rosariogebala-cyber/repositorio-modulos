/* Plantillas por rubro. Cada una combina otra navegación, portada, footer y otras variantes de módulos.
   Los textos, las fotos y los datos son ejemplos editables. */
(function () {
  var P = "../Proyectos/portal-studio/img/";
  var V = "img/rubros/viajes/";
  var I = "img/rubros/inmobiliaria/";

  window.LanzatePlantillas = [
    {
      id: "belleza", name: "Belleza y moda", match: /belleza|est[eé]tica|barber|peluquer|spa|moda|u[nñ]as/i,
      templates: [
        { name: "Estudio de estética", style: "Ciruela suave", font: "editorial", nav: "simple", hero: "compleja", footer: "media",
          image: ["img/rubros/estetica/hero.jpg", "Profesional realizando un tratamiento facial"],
          photos: [["img/rubros/estetica/hero.jpg", "Tratamiento facial en el estudio"], ["img/rubros/estetica/pro-1.jpg", "Cabina de tratamientos del estudio"], ["img/rubros/estetica/pro-2.jpg", "Detalle de un tratamiento de cuidado de la piel"], ["img/rubros/estetica/pro-3.jpg", "Productos de cuidado facial"]],
          title: "Tu piel, *en buenas manos*", lead: "Tratamientos faciales y corporales con un plan adaptado a tu piel.", action: "Reservá tu turno", target: "reserva-turno",
          highlights: ["Diagnóstico de piel|Empezamos por conocer tu tipo de piel.", "Productos profesionales|Elegidos según cada tratamiento.", "Seguimiento|Ajustamos el plan en cada visita."], icons: ["search-heart", "droplet", "calendar-heart"],
          people: ["Mariana G.", "Lucía R.", "Paula S."], quotes: ["Salí con la piel renovada y un plan claro para cuidarla en casa.", "Me explicaron cada paso del tratamiento. Volví al mes siguiente.", "Un lugar tranquilo, puntual y con mucha calidez."],
          closing: "Tu próximo tratamiento empieza con una consulta",
          sections: [
            { m: "servicios-productos-media", nav: "Tratamientos", title: "Tratamientos para cada momento", items: ["Higiene facial|Limpieza profunda según tu tipo de piel.", "Hidratación intensiva|Para pieles que necesitan recuperar confort.", "Masaje descontracturante|Maniobras suaves para aflojar la tensión."], bullets: ["Diagnóstico previo", "Extracción y limpieza", "Máscara calmante", "Sérum hidratante", "Máscara de colágeno", "Masaje facial", "Aceites esenciales", "Piedras calientes", "45 minutos de pausa"], lead: "¿No sabés cuál elegir? Te ayudamos en la primera consulta." },
            { m: "quienes-somos-media", nav: "El estudio", title: "Un espacio pensado *para tu pausa*", items: ["Cuidamos cada detalle|Te recibimos con tiempo, escuchamos qué buscás y armamos un plan que se adapte a tu rutina.", "Escucha|Cada piel tiene su historia.", "Constancia|Resultados que se sostienen.", "Calidez|Un trato cercano en cada visita."], lead: "En la primera visita conversamos sobre tus hábitos y el cuidado que buscás.", body: ["Después definimos juntas la frecuencia y los productos para continuar en casa."] },
            { m: "equipo-media", nav: "Equipo", title: "Las manos detrás de cada tratamiento", items: ["|Diagnóstico de piel y protocolos faciales.|Cosmetología", "|Masajes y tratamientos corporales.|Corporales", "|Atención, turnos y seguimiento.|Recepción"] },
            { m: "resenas-google-simple", title: "Lo que cuentan quienes ya vinieron" },
            { m: "reserva-turno-compleja", nav: "Turnos", title: "Reservá tu tratamiento", services: ["Higiene facial", "Hidratación intensiva", "Masaje descontracturante", "Consulta de diagnóstico"] },
            { m: "preguntas-frecuentes-media", title: "Antes de tu primera visita", items: ["¿Tengo que ir con la cara lavada?|No hace falta, empezamos cada sesión con una limpieza suave.", "¿Cuánto dura un tratamiento?|Entre 45 y 90 minutos, según lo que elijas.", "¿Puedo reprogramar?|Sí, avisanos con 24 horas de anticipación.", "¿Cómo pago?|Efectivo, transferencia o tarjeta en el estudio."] }
          ] },
        { name: "Barbería de barrio", style: "Grafito", font: "moderna", nav: "compleja", hero: "centrada", footer: "compleja", tint: "impar",
          image: ["img/rubros/barberia/hero-1.jpg", "Interior de una barbería"],
          photos: [["img/rubros/barberia/hero-1.jpg", "Sillones de la barbería"], ["img/rubros/barberia/hero-2.jpg", "Barbero trabajando un corte"], ["img/rubros/barberia/hero-3.jpg", "Herramientas de barbería sobre la mesada"]],
          title: "Cortes que *van con vos*", lead: "Cortes clásicos, fades y barba con cita previa, en el barrio de siempre.", action: "Elegí tu horario", target: "reserva-turno",
          highlights: ["Sin esperas", "Barba con toalla caliente", "Productos de la casa"],
          people: ["Nico P.", "Fede A.", "Juan M."], quotes: ["El mejor fade que me hicieron. Me explicaron cómo mantenerlo.", "Puntuales, buena música y un trato de diez.", "Voy hace dos años y siempre salgo conforme."], orgs: ["Cliente habitual", "Primer corte", "Cliente habitual"],
          closing: "Tu próximo corte, a un clic",
          sections: [
            { m: "galeria-imagenes-simple", nav: "La barbería", title: "Pasá a conocer la barbería" },
            { m: "lista-precios-simple", nav: "Precios", title: "Servicios y precios", kicker: "Precios", items: ["Corte clásico|Tijera y máquina, con lavado incluido.||$9.000", "Fade|Degradado trabajado según tu estilo.||$10.500", "Barba|Perfilado con toalla caliente.||$6.000", "Corte y barba|Los dos servicios en un turno.||$14.000", "Corte infantil|Para chicos hasta 12 años.||$7.500", "Color|Reflejos o cubrir canas.||$12.000"] },
            { m: "equipo-simple", title: "Los barberos", items: ["|Fades y cortes modernos", "|Barba y afeitado clásico", "|Cortes para chicos y adultos"] },
            { m: "casos-exito-simple", title: "Clientes que vuelven" },
            { m: "reserva-turno-media", nav: "Turnos", title: "Agendá tu corte *en un minuto*", lead: "Mirá los horarios libres de la semana y elegí el que mejor te quede." },
            { m: "donde-nos-encontramos-media", title: "Estamos a la vuelta" }
          ] }
      ]
    },
    {
      id: "bienestar", name: "Pilates y bienestar", match: /pilates|yoga|bienestar|fitness|gimnas|entrenamiento/i,
      templates: [
        { name: "Pilates Reformer", style: "Salvia", font: "moderna", nav: "simple", hero: "media", footer: "compleja",
          image: [P + "pilates.jpg", "Clase de pilates con reformer"],
          photos: [[P + "espacio.jpg", "Interior del estudio de pilates"], [P + "clase.jpg", "Clase grupal en el estudio"], [P + "funcional.jpg", "Entrenamiento funcional"], [P + "mat.jpg", "Clase de pilates mat"], [P + "estiramiento.jpg", "Estiramiento guiado"], [P + "pilates.jpg", "Reformer en uso"]],
          title: "Movimiento que *se adapta a vos*", lead: "Clases de Reformer en grupos chicos, con acompañamiento desde la primera sesión.", action: "Reservá una clase", target: "reserva-turno",
          highlights: ["Grupos de 6 personas", "Todos los niveles", "Primera clase guiada"],
          people: ["Carla V.", "Inés M.", "Rocío B."], quotes: ["Llegué con dolor de espalda y hoy entreno tres veces por semana.", "Las clases son chicas y te corrigen todo el tiempo.", "Se nota la formación de las profes. Muy recomendable."],
          closing: "Tu primera clase te está esperando",
          sections: [
            { m: "imagen-texto-media", nav: "El estudio", title: "Entrená *en grupos chicos*", kicker: "Por qué elegirnos", lead: "Empezamos por conocer cómo te movés y adaptamos cada ejercicio a tu nivel.", bullets: ["Máximo seis personas por clase", "Profes con formación certificada", "Reformers nuevos y regulables"] },
            { m: "proceso-media", nav: "Cómo empezar", title: "Tu primera clase, paso a paso", items: ["Reservá|Elegí día y horario desde la web.", "Contanos|Hablamos de lesiones y objetivos.", "Probá|Hacés una clase guiada de 50 minutos.", "Elegí tu plan|Seguís con la frecuencia que te sirva."] },
            { m: "galeria-imagenes-media", nav: "Clases", title: "Así son las clases", items: ["Reformer|Máquina|Reformer", "Mat|Suelo|Mat", "Funcional|Fuerza|Funcional", "Estiramiento|Movilidad|Movilidad", "El espacio|Estudio|Estudio", "En grupo|Clase|Reformer"] },
            { m: "cifras-simple", nav: "Trayectoria", title: "El estudio *en números*", items: ["6|personas por clase como máximo", "+40|clases por semana", "8|años en el barrio", "4,9|de puntaje en Google"] },
            { m: "resenas-google-media", title: "Lo que dicen nuestras alumnas" },
            { m: "reserva-turno-simple", nav: "Reservas", title: "Elegí tu clase", services: ["Primera clase", "Reformer inicial", "Reformer intermedio", "Mat"] }
          ] },
        { name: "Estudio de yoga", style: "Lavanda", font: "editorial", nav: "compleja", hero: "dividida", footer: "media",
          image: [P + "yoga.jpg", "Práctica de yoga sobre colchoneta"],
          photos: [[P + "yoga.jpg", "Práctica de yoga"], [P + "estiramiento.jpg", "Postura de estiramiento"], [P + "espacio.jpg", "Sala de práctica luminosa"], [P + "mat.jpg", "Colchonetas listas para la clase"]],
          title: "Encontrá tu ritmo *en la práctica*", lead: "Yoga suave, movilidad y respiración para volver al cuerpo.", action: "Conocé las clases", target: "beneficios",
          highlights: ["Grupos reducidos", "Primera clase abierta"],
          closing: "Volvé a tu respiración",
          sections: [
            { m: "quienes-somos-simple", nav: "Nosotras", title: "Un lugar para bajar un cambio", kicker: "Quiénes somos", lead: "Abrimos el estudio para quienes buscan una práctica amable, sin exigencias ni comparaciones.", body: ["Cada clase combina movimiento, respiración y un cierre de relajación.", "Práctica consciente. Grupos reducidos."] },
            { m: "beneficios-media", nav: "Clases", title: "Prácticas para cada día", items: ["Yoga suave|Secuencias tranquilas para empezar o retomar.", "Vinyasa|Movimiento fluido coordinado con la respiración.", "Respiración|Técnicas para soltar la tensión del día.", "Meditación|Encuentros guiados de 30 minutos."] },
            { m: "video-destacado-simple", title: "Mirá cómo es una clase", images: [[P + "estiramiento.jpg", "Fotograma de una clase de yoga"]] },
            { m: "agenda-simple", nav: "Agenda", title: "Encuentros especiales", kicker: "Agenda", items: ["Taller de respiración|Sábado de 10 a 12 h. Cupos limitados.|14 dic", "Yoga al aire libre|Domingo a las 9 h en el parque.|22 dic", "Retiro de un día|Práctica, almuerzo y meditación.|18 ene"] },
            { m: "equipo-compleja", title: "Quienes guían la práctica", items: ["Acompañamos tu proceso|Profes con años de práctica y formación en yoga terapéutico.", "|Hatha y yoga suave", "|Vinyasa y movilidad", "|Meditación y respiración"] },
            { m: "preguntas-frecuentes-compleja", title: "Preguntas antes de empezar", filters: ["Primera clase", "Clases", "Pagos"], items: ["¿Necesito experiencia?|No. El grupo inicial está pensado para empezar de cero.", "¿Qué llevo?|Ropa cómoda y agua. Tenemos colchonetas.", "¿Puedo ir embarazada?|Sí, avisanos y adaptamos la práctica.", "¿Cuánto dura una clase?|Una hora con relajación final.", "¿Hay clases de prueba?|Sí, la primera clase es abierta.", "¿Cómo pago?|Por clase suelta o abono mensual."] },
            { m: "donde-nos-encontramos-simple", title: "Vení a practicar", items: ["Visitanos", "Horarios", "Clase de prueba|Escribinos y te guardamos un lugar."] }
          ] },
        { name: "Gimnasio funcional", style: "Coral", font: "moderna", nav: "media", hero: "datos", footer: "simple", tint: "impar",
          image: [P + "funcional.jpg", "Entrenamiento funcional en grupo"],
          photos: [[P + "funcional.jpg", "Entrenamiento funcional"], [P + "clase.jpg", "Clase grupal de alta intensidad"], [P + "hero.jpg", "Sala de entrenamiento"]],
          title: "Entrená fuerte, *entrená bien*", lead: "Clases funcionales de 45 minutos con coach en cada turno.", action: "Probá una clase gratis", target: "proceso",
          highlights: ["Coach en cada clase|Corrección de técnica todo el tiempo.", "Turnos cada hora|De 7 a 22, de lunes a sábado.", "Plan a medida|Medimos tu progreso cada mes."], icons: ["person-arms-up", "clock", "graph-up-arrow"],
          people: ["Martín G.", "Sole P.", "Agus R.", "Lean F."], quotes: ["En tres meses mejoré la fuerza y la postura. Los coaches están en todo.", "Buen ambiente y clases que se pasan volando.", "Me adaptaron los ejercicios por una lesión de rodilla.", "El mejor horario para entrenar antes del trabajo."], orgs: ["Funcional", "Fuerza", "Movilidad", "Funcional"],
          closing: "Tu primera clase va por nuestra cuenta",
          sections: [
            { m: "beneficios-simple", nav: "Por qué", title: "Más que un gimnasio, *un equipo*", kicker: "Beneficios", items: ["Clases cortas|45 minutos que rinden.", "Grupos reducidos|Hasta 12 personas por turno.", "Seguimiento|Evaluación física mensual.", "Comunidad|Entrenar acompañado motiva."], icons: ["stopwatch", "people", "clipboard-data", "heart-pulse"] },
            { m: "cifras-media", nav: "El box", title: "Un box que *no para*", lead: "Más de 300 personas entrenan con nosotros cada semana.", items: ["+300|socios activos", "60|clases por semana", "15 h|de entrenamiento por día", "12|personas por turno"] },
            { m: "proceso-simple", nav: "Empezar", title: "Empezá esta semana", items: ["Agendá|Elegí tu clase de prueba.", "Evaluamos|Medimos fuerza y movilidad.", "Entrenás|Arrancás con tu plan."] },
            { m: "equipo-media", title: "Los coaches", items: ["|Fuerza y acondicionamiento.|Head coach", "|Movilidad y prevención de lesiones.|Kinesiología", "|Clases grupales de alta intensidad.|Coach"] },
            { m: "casos-exito-media", nav: "Historias", title: "Historias del box" },
            { m: "preguntas-frecuentes-simple", title: "Dudas frecuentes", items: ["¿Necesito estar en forma?|No, adaptamos cada ejercicio a tu nivel.", "¿Qué planes hay?|Dos, tres o cinco veces por semana.", "¿Hay vestuarios?|Sí, con duchas y lockers.", "¿Puedo congelar el abono?|Sí, por viaje o lesión."] }
          ] }
      ]
    },
    {
      id: "salud", name: "Salud y consultorios", match: /salud|m[eé]dic|cl[ií]nic|odont|consultorio|psic[oó]log|nutrici/i,
      templates: [
        { name: "Consultorio odontológico", style: "Azul clínico", font: "moderna", nav: "media", hero: "dividida", footer: "compleja",
          image: ["img/plantillas/odontologia.webp", "Profesional en un consultorio odontológico"],
          photos: [["img/plantillas/odontologia.webp", "Consultorio odontológico equipado"], ["img/lugar.jpg", "Sala de espera luminosa"]],
          title: "Cuidá tu sonrisa *desde el primer control*", lead: "Consultas programadas para prevención, higiene y evaluación odontológica.", action: "Solicitá un turno", target: "reserva-turno",
          highlights: ["Obras sociales", "Turnos en el día", "Atención a chicos"],
          people: ["Gabriela S.", "Hernán T.", "Micaela D."], quotes: ["Le tenía miedo al dentista y me atendieron con mucha paciencia.", "Explican todo antes de empezar y cumplen con los horarios.", "Llevé a mis hijos y salieron contentos."],
          closing: "Tu próximo control, sin demoras",
          sections: [
            { m: "servicios-productos-simple", nav: "Servicios", title: "Motivos de consulta", kicker: "Especialidades", items: ["Control y limpieza|Revisión general e higiene profesional.", "Ortodoncia|Evaluación y seguimiento de brackets y alineadores.", "Implantes|Planificación con estudios previos."] },
            { m: "proceso-compleja", nav: "Tu visita", title: "Así es tu primera consulta", items: ["Paso a paso|Cada etapa tiene un objetivo claro y te explicamos las opciones.", "Recepción|Datos y obra social.", "Revisión|Examen y radiografía si hace falta.", "Diagnóstico|Te contamos qué vimos.", "Plan|Presupuesto y próximos turnos."] },
            { m: "equipo-simple", title: "Profesionales del consultorio", items: ["|Odontología general", "|Ortodoncia", "|Odontopediatría"] },
            { m: "resenas-google-compleja", title: "Pacientes que confían en nosotros", filters: ["Atención", "Puntualidad", "Chicos"] },
            { m: "marcas-simple", nav: "Coberturas", title: "Obras sociales y prepagas", bullets: ["OSDE", "Swiss Medical", "Galeno", "Medifé", "Omint", "Sancor Salud"] },
            { m: "reserva-turno-simple", nav: "Turnos", title: "Solicitá tu turno", services: ["Control y limpieza", "Ortodoncia", "Implantes", "Urgencia"] },
            { m: "donde-nos-encontramos-compleja", title: "Cómo llegar al consultorio", items: ["Un consultorio cerca tuyo|Planta baja con acceso para sillas de ruedas.", "Transporte público|Colectivos y subte a pocas cuadras.", "Si venís en auto|Estacionamiento medido sobre la avenida."] }
          ] },
        { name: "Espacio de psicología", style: "Celeste humo", font: "clasica", nav: "simple", hero: "simple", footer: "media", tint: "impar",
          image: ["img/quienes-media.jpg", "Dos personas conversando en un consultorio"],
          photos: [["img/quienes-compleja.jpg", "Profesional conversando con una paciente"], ["img/lugar.jpg", "Entrada luminosa del consultorio"]],
          title: "Un espacio para *hablar con tiempo*", lead: "Terapia individual y de pareja, presencial y online.", action: "Pedí una primera entrevista", target: "reserva-turno",
          closing: "Dar el primer paso también es cuidarte",
          sections: [
            { m: "quienes-somos-compleja", nav: "Enfoque", title: "Acompañamos procesos, *a tu ritmo*", lead: "Somos un equipo de psicólogas con orientación cognitiva y sistémica.", items: ["Cómo trabajamos|Encuentros semanales con objetivos que revisamos juntas.", "Qué podés esperar|Escucha, confidencialidad y herramientas para tu día a día."] },
            { m: "beneficios-media", nav: "Terapias", title: "Modalidades de atención", items: ["Terapia individual|Ansiedad, duelos, cambios y vínculos.", "Terapia de pareja|Comunicación y acuerdos.", "Adolescentes|Un espacio propio con su profesional.", "Online|Sesiones por videollamada desde donde estés."] },
            { m: "proceso-media", title: "Cómo empezar", items: ["Escribinos|Contanos brevemente qué te pasa.", "Entrevista inicial|Una charla para conocernos.", "Definimos el encuadre|Frecuencia, modalidad y honorarios.", "Empezamos|Sesiones de 50 minutos."] },
            { m: "llamado-simple", nav: "Contacto", title: "¿Es momento de *empezar*?", lead: "Escribinos y coordinamos una primera entrevista sin compromiso." },
            { m: "preguntas-frecuentes-media", title: "Preguntas frecuentes", items: ["¿Atienden por obra social?|Trabajamos con reintegros. Te damos la factura.", "¿La terapia online funciona igual?|Sí, con la misma confidencialidad.", "¿Cuánto dura un tratamiento?|Depende de cada proceso. Lo revisamos juntas.", "¿Qué pasa si falto?|Avisá con 24 horas y reprogramamos."] },
            { m: "reserva-turno-media", nav: "Turnos", title: "Pedí tu *primera entrevista*", lead: "Elegí un horario disponible y te confirmamos por mail." }
          ] }
      ]
    },
    {
      id: "gastronomia", name: "Gastronomía", match: /gastron|restaur|caf[eé]|panader|pasteler|bistr[oó]|comida/i,
      templates: [
        { name: "Bistró de temporada", style: "Vino y cacao", font: "editorial", nav: "compleja", hero: "centrada", footer: "compleja",
          image: ["img/plantillas/bistro.webp", "Plato de pasta servido en una mesa oscura"],
          photos: [[V + "cat-gastronomia.webp", "Cocina abierta con platos de estación"], ["img/plantillas/bistro.webp", "Pasta casera servida en la mesa"]],
          title: "Una mesa para disfrutar *sin apuro*", lead: "Cocina de estación, pastas caseras y una carta que cambia con el mercado.", action: "Reservá una mesa", target: "reserva-turno",
          highlights: ["Carta de estación|Productos frescos del mercado.", "Pastas caseras|Hechas cada mañana.", "Vinos de autor|Bodegas chicas del país."], icons: ["basket", "fire", "cup-straw"],
          people: ["Lorena B.", "Andrés C.", "Vicky M."], quotes: ["Los ravioles de calabaza son de otro planeta. Volvimos a la semana.", "Atención cálida y una carta de vinos muy bien elegida.", "Ideal para una cena tranquila de a dos."],
          closing: "Te guardamos una mesa",
          sections: [
            { m: "imagen-texto-simple", nav: "La cocina", title: "Cocinamos con lo que trae *la estación*", kicker: "Nuestra cocina", lead: "Cada semana armamos la carta con productores de la zona. Lo que no está fresco, no entra a la cocina." },
            { m: "lista-precios-media", nav: "Carta", title: "La carta *de esta semana*", kicker: "Carta", lead: "Cambia con lo que trae el mercado. Preguntá por el plato del día.", items: ["Ravioles de calabaza|Manteca de salvia y nueces tostadas.||$14.500", "Ojo de bife|Papas rústicas y chimichurri de la casa.||$19.800", "Risotto de hongos|Hongos de pino y parmesano.||$15.200", "Flan casero|Dulce de leche y crema.||$6.500"], images: [["img/plantillas/bistro.webp", "Plato de pasta casera"]] },
            { m: "resenas-google-media", title: "Lo que dicen de la mesa" },
            { m: "donde-nos-encontramos-compleja", title: "Vení a cenar", items: ["Un rincón para quedarse|Salón íntimo y patio en verano.", "Transporte público|A dos cuadras de la avenida.", "Si venís en auto|Estacionamiento en la esquina."] },
            { m: "reserva-turno-media", nav: "Reservas", title: "Reservá tu mesa *en un minuto*", lead: "Elegí día y horario. Te confirmamos por mail." }
          ] },
        { name: "Café de especialidad", style: "Café tostado", font: "clasica", nav: "simple", hero: "mosaico", footer: "media", tint: "impar",
          image: ["img/plantillas/cafe.webp", "Café y pastelería en una mesa luminosa"],
          photos: [["img/plantillas/cafe.webp", "Café y pastelería del día"], ["img/beneficio-foto.jpg", "Taza de café junto a una planta"]],
          title: "Buen café, *hecho con tiempo*", lead: "Espresso, filtrados y pastelería para disfrutar acá o llevar.", action: "Mirá la carta", target: "lista-precios",
          highlights: ["Tostado propio", "Pastelería del día", "Wifi y enchufes"], icons: ["fire", "cup-hot", "wifi"],
          closing: "Te esperamos con el café listo",
          sections: [
            { m: "beneficios-compleja", nav: "El café", title: "Lo que nos hace distintos", items: ["Granos de origen|Compramos directo a fincas.", "Tostado semanal|Siempre fresco.", "Baristas formados|Cada taza, a punto.", "Para llevar|Vasos compostables."], icons: ["globe-americas", "fire", "cup-hot", "bag"] },
            { m: "lista-precios-simple", nav: "Carta", title: "La carta del café", kicker: "Carta", items: ["Espresso|Blend de la casa, tostado esta semana.||$2.800", "Flat white|Doble espresso con leche texturizada.||$3.900", "Filtrado del día|V60 o Chemex con origen rotativo.||$4.200", "Cold brew|Infusionado durante 18 horas.||$4.000", "Medialunas|De manteca, horneadas cada mañana.||$1.200", "Budín del día|Limón, banana o chocolate.||$3.200"] },
            { m: "quienes-somos-simple", title: "Una esquina para *quedarse*", kicker: "Nuestra historia", lead: "Abrimos en 2019 con una máquina, dos mesas y muchas ganas de servir buen café.", body: ["Hoy seguimos tostando cada semana y horneando todo en el local.", "Café de verdad. Gente de barrio."] },
            { m: "preguntas-frecuentes-simple", title: "Antes de venir", items: ["¿Tienen opciones sin TACC?|Sí, preguntá por la pastelería del día.", "¿Puedo ir a trabajar?|Claro, hay wifi y enchufes.", "¿Venden café en grano?|Sí, en bolsas de 250 g y 1 kg.", "¿Aceptan mascotas?|Sí, en las mesas de la vereda."] },
            { m: "donde-nos-encontramos-simple", title: "Pasá por el café", items: ["Visitanos", "Horarios", "Pedidos para llevar|Escribinos y te lo dejamos listo."] }
          ] }
      ]
    },
    {
      id: "turismo", name: "Viajes y turismo", match: /viaje|turismo|hotel|excurs|agencia/i,
      templates: [
        { name: "Escapadas a la Patagonia", style: "Litoral", font: "moderna", nav: "media", hero: "marco", footer: "compleja",
          image: [V + "dest-bariloche.webp", "Paisaje patagónico en Bariloche"],
          photos: [[V + "dest-bariloche.webp", "Lago Nahuel Huapi entre montañas"], [V + "hero-2.webp", "Caminante frente al cerro Fitz Roy"], [V + "promo-ushuaia.webp", "Faro en el Canal Beagle"], [V + "cat-aventura.webp", "Montañista en una cumbre nevada"]],
          title: "Unos días al sur *cambian el ritmo*", lead: "Armá tu viaje entre lagos, senderos y pueblos de montaña.", action: "Explorá los destinos", target: "productos",
          highlights: ["Itinerarios a medida|Según tus fechas y tu ritmo.", "Traslados incluidos|Del aeropuerto al alojamiento.", "Asistencia 24 h|Te acompañamos todo el viaje."], icons: ["map", "bus-front", "headset"],
          people: ["Flor y Diego", "Julieta K.", "Familia Rossi"], quotes: ["Todo salió como lo planeamos. Las excursiones, impecables.", "Nos armaron un recorrido perfecto para ir con chicos.", "Volvimos con ganas de repetir el viaje el año que viene."], orgs: ["Bariloche", "Ushuaia", "El Calafate"],
          closing: "Tu próxima escapada empieza acá",
          sections: [
            { m: "productos-media", nav: "Destinos", title: "Elegí tu escapada", filters: ["Lagos", "Montaña", "Costa"], items: ["Bariloche", "El Chaltén", "Ushuaia"], images: [[V + "dest-bariloche.webp", "Lago en Bariloche"], [V + "cat-aventura.webp", "Senderos de El Chaltén"], [V + "promo-ushuaia.webp", "Bahía de Ushuaia"]] },
            { m: "agenda-media", nav: "Salidas", title: "Próximas salidas grupales", action: "Reservá tu lugar", items: ["Ruta de los Siete Lagos|Cinco días entre Bariloche y San Martín de los Andes.|Sáb 11 ene · 5 días", "Trekking en El Chaltén|Cuatro días de senderos y glaciares.|Jue 23 ene · 4 días", "Fin del mundo|Ushuaia, Canal Beagle y Parque Nacional.|Lun 10 feb · 6 días"] },
            { m: "proceso-compleja", nav: "Cómo viajar", title: "Cómo armamos tu itinerario", items: ["Tu viaje, sin vueltas|Nos ocupamos de reservas, traslados y excursiones.", "Fechas|Contanos cuándo podés viajar.", "Recorrido|Elegimos actividades según tu ritmo.", "Propuesta|Te mandamos el detalle con precios.", "Viaje|Te acompañamos antes y durante."] },
            { m: "cifras-simple", nav: "Trayectoria", title: "Viajamos al sur *desde 2009*", items: ["+4.000|viajeros acompañados", "35|destinos patagónicos", "24 h|de asistencia en viaje", "4,9|de puntaje en Google"] },
            { m: "casos-exito-media", title: "Viajeros que volvieron felices" },
            { m: "preguntas-frecuentes-media", title: "Antes de viajar", items: ["¿Qué incluye cada paquete?|Alojamiento, traslados y las excursiones que elijas.", "¿Cuál es la mejor época?|De noviembre a marzo para trekking, de julio a septiembre para nieve.", "¿Puedo pagar en cuotas?|Sí, con tarjeta de crédito.", "¿Necesito seguro de viaje?|Lo recomendamos y lo podemos sumar."] }
          ] },
        { name: "Vacaciones en el Caribe", style: "Petróleo", font: "editorial", nav: "compleja", hero: "simple", footer: "media", tint: "impar",
          image: [V + "dest-cancun.webp", "Playa en Cancún"],
          photos: [[V + "cat-playa.webp", "Playa de arena blanca"], [V + "promo-puntacana.webp", "Palmeras en Punta Cana"], [V + "dest-cancun.webp", "Mar turquesa en Cancún"], [V + "promo-miami.webp", "Costa de Miami"], [V + "promo-floripa.webp", "Playa de Florianópolis"], [V + "cat-romance.webp", "Atardecer frente al mar"]],
          title: "Tu próxima pausa *queda frente al mar*", lead: "Compará destinos del Caribe y encontrá una opción para tu forma de viajar.", action: "Compará destinos", target: "productos",
          people: ["Caro y Mati", "Sergio L.", "Ana P."], quotes: ["El all inclusive que nos recomendaron fue perfecto para la luna de miel.", "Respondieron cada consulta, incluso estando allá.", "Precios claros y sin sorpresas."],
          closing: "El mar te está esperando",
          sections: [
            { m: "galeria-imagenes-media", nav: "Playas", title: "Playas para todos los gustos", items: ["Arena blanca|Riviera Maya|Relax", "Punta Cana|República Dominicana|All inclusive", "Mar turquesa|Cancún|Relax", "Miami|Estados Unidos|Ciudad", "Florianópolis|Brasil|Familia", "Atardeceres|Luna de miel|Pareja"] },
            { m: "productos-simple", nav: "Destinos", title: "Destinos destacados", items: ["Cancún||7 noches · all inclusive|Desde USD 1.450", "Punta Cana||7 noches · frente al mar|Desde USD 1.320", "Riviera Maya||10 noches · hotel boutique|Desde USD 1.980"], images: [[V + "dest-cancun.webp", "Playa en Cancún"], [V + "promo-puntacana.webp", "Hotel en Punta Cana"], [V + "cat-playa.webp", "Playa de la Riviera Maya"]] },
            { m: "beneficios-media", title: "Qué incluye tu viaje", items: ["Vuelos|Con equipaje y asientos juntos.", "Alojamiento|Hoteles elegidos por nuestro equipo.", "Traslados|Aeropuerto, hotel y excursiones.", "Asistencia|Seguro médico y contacto 24 h."] },
            { m: "resenas-google-compleja", title: "Lo que cuentan nuestros viajeros", filters: ["Atención", "Hoteles", "Precios"] },
            { m: "equipo-media", title: "Tus asesoras de viaje", items: ["|Especialista en Caribe y luna de miel.|Caribe", "|Viajes en familia y grupos.|Familias", "|Cruceros y paquetes combinados.|Cruceros"] },
            { m: "llamado-media", nav: "Cotizá", title: "¿Ya elegiste *tu playa*?", lead: "Contanos fechas y presupuesto y te armamos tres opciones en 24 horas." },
            { m: "donde-nos-encontramos-media", title: "Pasá por la agencia" }
          ] }
      ]
    },
    {
      id: "inmobiliaria", name: "Inmobiliaria", match: /inmobil|propiedad|bien(?:es)? ra[ií]z|alquiler|arquitect/i,
      templates: [
        { name: "Propiedades para visitar", style: "Pizarra", font: "clasica", nav: "media", hero: "simple", footer: "compleja",
          image: [I + "hero-1.jpg", "Interior luminoso de una propiedad"],
          photos: [[I + "hero-2.jpg", "Living con ventanales"], [I + "hero-3.jpg", "Cocina integrada"], [I + "hero-4.jpg", "Frente de casa con jardín"], ["img/galx-main.jpg", "Living abierto al jardín"], ["img/galx-th2.jpg", "Cocina con isla de madera"], ["img/galx-th3.jpg", "Dormitorio en tonos claros"], ["img/galx-living.jpg", "Ambientes integrados"], ["img/galx-ideas.jpg", "Escritorio junto a la ventana"], ["img/galx-pausa.jpg", "Rincón de lectura"]],
          title: "Encontrá un lugar *para tu próxima etapa*", lead: "Explorá propiedades y elegí cuáles querés conocer en persona.", action: "Ver propiedades", target: "productos",
          closing: "Coordinemos tu próxima visita",
          sections: [
            { m: "productos-media", nav: "Propiedades", title: "Propiedades destacadas", filters: ["Venta", "Alquiler", "Temporario"], items: ["Depto. 3 ambientes", "Casa con jardín", "Monoambiente a estrenar"], images: [[I + "prop-1.jpg", "Departamento de tres ambientes"], [I + "prop-2.jpg", "Casa con jardín"], [I + "prop-3.jpg", "Monoambiente a estrenar"]] },
            { m: "galeria-imagenes-compleja", nav: "Galería", title: "Ambientes que se sienten *hogar*", items: ["Living con ventanales", "Cocina integrada", "Dormitorio principal", "Ambientes amplios", "Escritorio con luz natural", "Rincón de lectura", "Vista al verde", "Detalles en madera", "Living al jardín"], kicker: "Galería", filters: ["Livings", "Cocinas", "Dormitorios"], lead: "Fotos reales de propiedades disponibles este mes." },
            { m: "proceso-media", title: "Cómo coordinar una visita", items: ["Elegí|Marcá las propiedades que te interesan.", "Agendá|Proponé día y horario.", "Visitá|Te acompaña un asesor.", "Ofertá|Te ayudamos con la reserva."] },
            { m: "cifras-simple", nav: "Trayectoria", title: "Una inmobiliaria *con historia*", items: ["+1.200|operaciones cerradas", "25|años en el barrio", "180|propiedades disponibles", "4,8|de puntaje en Google"] },
            { m: "equipo-compleja", title: "Asesores que conocen el barrio", items: ["Te acompañamos en cada paso|Asesores matriculados con experiencia en la zona.", "|Ventas", "|Alquileres", "|Tasaciones"] },
            { m: "reserva-turno-simple", nav: "Visitas", title: "Coordiná una visita", services: ["Depto. 3 ambientes", "Casa con jardín", "Monoambiente a estrenar"] }
          ] },
        { name: "Tasaciones inmobiliarias", style: "Arena", font: "editorial", nav: "simple", hero: "dividida", footer: "media", tint: "impar",
          image: [I + "hero-4.jpg", "Propiedad residencial"],
          photos: [[I + "hero-2.jpg", "Interior de una propiedad tasada"], [I + "hero-3.jpg", "Ambiente amplio"]],
          title: "Conocé el valor *de tu propiedad*", lead: "Una tasación para tomar decisiones con referencias claras del mercado.", action: "Pedí tu tasación", target: "proceso",
          highlights: ["Informe escrito|Con comparables de la zona.", "En 72 horas|Desde la visita.", "Sin compromiso|Decidís después."], icons: ["file-earmark-text", "clock-history", "hand-thumbs-up"],
          people: ["Raúl M.", "Silvia T.", "Pedro A."], quotes: ["El informe fue claro y vendimos en el rango que nos dijeron.", "Vinieron en el día y me explicaron todo con números.", "Profesionales y muy atentos."],
          closing: "Sabé cuánto vale antes de decidir",
          sections: [
            { m: "quienes-somos-media", nav: "Nosotros", title: "Tasamos con *datos reales*", items: ["Más de 20 años en la zona|Conocemos cada barrio, sus precios y cómo se mueve el mercado.", "Rigor|Comparables verificados.", "Claridad|Un informe que se entiende.", "Cercanía|Te explicamos cada número."], lead: "Combinamos la visita a la propiedad con un análisis de ventas recientes.", body: ["Así llegás a un precio que el mercado acepta."] },
            { m: "proceso-simple", nav: "Proceso", title: "De la consulta al informe", items: ["Reunimos datos|Ubicación, superficie y estado.", "Comparamos|Ventas recientes en la zona.", "Presentamos|Un rango con sus fundamentos."] },
            { m: "cifras-media", nav: "Respaldo", title: "Tasaciones *con respaldo*", lead: "Cada informe se apoya en operaciones reales de la zona.", items: ["+3.000|tasaciones realizadas", "72 h|para recibir el informe", "20|años en la zona", "95 %|de ventas dentro del rango"] },
            { m: "beneficios-simple", title: "Por qué tasar con nosotros", kicker: "Beneficios", items: ["Precio justo|Ni muy alto ni muy bajo.", "Rapidez|Informe en 72 horas.", "Respaldo|Firmado por martillero.", "Sin costo|Si vendés con nosotros."], icons: ["scales", "lightning", "patch-check", "piggy-bank"] },
            { m: "resenas-google-simple", title: "Propietarios que confiaron" },
            { m: "preguntas-frecuentes-media", title: "Consultas sobre tasaciones", items: ["¿Qué documentación sirve?|Escritura, planos y expensas.", "¿Se visita la propiedad?|Sí, la visita es parte de la tasación.", "¿Cuánto cuesta?|Es sin cargo si nos elegís para vender.", "¿Sirve para sucesiones?|Sí, emitimos informes formales."] }
          ] }
      ]
    },
    {
      id: "educacion", name: "Educación y libros", match: /educaci[oó]n|idioma|academia|escuela|curso|libro|clases/i,
      templates: [
        { name: "Academia de idiomas", style: "Índigo", font: "moderna", nav: "compleja", hero: "media", footer: "compleja",
          image: ["img/rubros/idiomas/hero.jpg", "Clase de idiomas"],
          photos: [["img/rubros/idiomas/hero.jpg", "Estudiantes en clase"], ["img/rubros/idiomas/prof-1.jpg", "Profesora explicando en el pizarrón"]],
          title: "Hablá otro idioma *con confianza*", lead: "Cursos por nivel, práctica de conversación y grupos reducidos.", action: "Hacé el test de nivel", target: "servicios-productos",
          highlights: ["Inglés", "Portugués", "Italiano"],
          people: ["Lucas F.", "Belén R.", "Ignacio V."], quotes: ["En un año pasé de no animarme a hablar a dar presentaciones en inglés.", "Los grupos son chicos y se practica mucho.", "Me preparé para el First y aprobé con buena nota."], orgs: ["Inglés B2", "Portugués", "Examen First"],
          closing: "Tu próximo idioma empieza con un test",
          sections: [
            { m: "servicios-productos-media", nav: "Cursos", title: "Modalidades de cursada", items: ["Grupal|Hasta 8 estudiantes por nivel.", "Conversación|Práctica oral con temas de interés.", "Individual|Objetivos a tu ritmo."], bullets: ["Dos clases por semana", "Material incluido", "Certificado por nivel", "Una vez por semana", "Debates y juegos", "Profes nativos", "Horario flexible", "Preparación de exámenes", "Online o presencial"], lead: "¿No sabés tu nivel? Hacé el test gratis." },
            { m: "agenda-simple", nav: "Inicios", title: "Próximos inicios", kicker: "Inscripciones abiertas", items: ["Inglés inicial|Lunes y miércoles de 19 a 20:30 h.|3 mar", "Portugués desde cero|Martes y jueves de 18 a 19:30 h.|4 mar", "Preparación First|Sábados de 10 a 13 h.|8 mar"] },
            { m: "equipo-media", title: "Profes que enseñan *con pasión*", items: ["|Inglés para adultos y empresas.|Inglés", "|Portugués desde cero.|Portugués", "|Preparación de exámenes internacionales.|Exámenes"] },
            { m: "beneficios-compleja", title: "Por qué estudiar con nosotros", items: ["Grupos chicos|Más tiempo para hablar.", "Test de nivel|Empezás donde corresponde.", "Certificados|Validan tu progreso.", "Online|Clases en vivo desde tu casa."], icons: ["people", "clipboard-check", "award", "laptop"] },
            { m: "casos-exito-simple", title: "Estudiantes que se animaron" },
            { m: "preguntas-frecuentes-compleja", title: "Antes de inscribirte", filters: ["Cursos", "Niveles", "Pagos"], items: ["¿Cuándo empiezan los cursos?|En marzo y agosto, con ingresos mensuales.", "¿Cuánto dura cada nivel?|Un cuatrimestre.", "¿Cómo sé mi nivel?|Con un test online de 20 minutos.", "¿Puedo cambiar de grupo?|Sí, según disponibilidad.", "¿Hay descuentos?|Para hermanos y pagos anuales.", "¿Entregan factura?|Sí, A o B."] }
          ] },
        { name: "Taller de lectura", style: "Azul tinta", font: "editorial", nav: "simple", hero: "mosaico", footer: "simple",
          image: ["img/plantillas/lectura.webp", "Libros y cuadernos en una mesa de lectura"],
          photos: [["img/plantillas/lectura.webp", "Libros y cuadernos en la mesa del taller"], ["img/gal-pausa.jpg", "Taza junto a un libro abierto"], ["img/galx-pausa.jpg", "Sillón de lectura con manta"], ["img/gal-ideas.jpg", "Cuaderno de notas sobre la mesa"]],
          title: "Leamos juntos, *una historia a la vez*", people: ["Silvia R.", "Martín A.", "Inés C."], quotes: ["Volví a leer después de años. Las charlas son lo mejor de la semana.", "Descubrí autores que nunca hubiera elegido sola.", "Un grupo cálido, con lecturas muy bien elegidas."], lead: "Encuentros para descubrir autores, intercambiar miradas y recuperar el tiempo de lectura.", action: "Ver próximos encuentros", target: "reserva-turno",
          highlights: ["Encuentros quincenales|Dos horas alrededor de un libro."], icons: ["book"],
          closing: "Guardate un lugar en la mesa",
          sections: [
            { m: "quienes-somos-simple", nav: "El taller", title: "Un taller para *leer acompañados*", kicker: "Sobre el taller", lead: "Nos juntamos cada quince días alrededor de un libro. No hace falta saber de literatura, solo tener ganas de leer.", body: ["Cada encuentro tiene una guía de lectura y una charla abierta.", "Lecturas compartidas. Charlas sin apuro."] },
            { m: "servicios-productos-simple", nav: "Propuestas", title: "Formas de participar", kicker: "Propuestas", items: ["Club mensual|Una novela para leer y comentar en grupo.", "Lectura guiada|Fragmentos y contexto en cada encuentro.", "Escritura|Ejercicios a partir de lo leído."] },
            { m: "proceso-simple", title: "Cómo funciona", items: ["Elegimos|Votamos el libro del mes.", "Leemos|Con una guía de preguntas.", "Charlamos|Un encuentro de dos horas."] },
            { m: "resenas-google-media", title: "Lo que dicen quienes participan" },
            { m: "agenda-media", nav: "Agenda", title: "Próximos encuentros", items: ["Cuentos de Cortázar|Leemos «Bestiario» y charlamos sobre lo fantástico.|Jue 12 dic · 19 h", "La novela del verano|Elegimos juntos la lectura de enero.|Jue 9 ene · 19 h", "Escribir a partir de lo leído|Ejercicios breves y lectura en voz alta.|Sáb 18 ene · 11 h"] },
            { m: "reserva-turno-simple", nav: "Encuentros", title: "Elegí un encuentro", services: ["Club mensual", "Lectura guiada", "Escritura", "Encuentro abierto"] }
          ] }
      ]
    },
    {
      id: "servicios", name: "Negocios y servicios", match: /servicio|consultor|empresa|estudio|contador|abogad/i,
      templates: [
        { name: "Consultoría para pymes", style: "Profesional", font: "moderna", nav: "media", hero: "dividida", footer: "compleja",
          image: ["img/equipo-grupo.jpg", "Equipo de trabajo en una reunión"],
          photos: [["img/quienes-media.jpg", "Reunión de diagnóstico"], ["img/quienes-compleja.jpg", "Consultores revisando indicadores"], ["img/equipo-grupo.jpg", "Equipo de trabajo"]],
          title: "Ordená tus procesos *para crecer*", lead: "Diagnóstico, prioridades y un plan de trabajo para el próximo paso de tu empresa.", action: "Agendá un diagnóstico", target: "proceso",
          highlights: ["Diagnóstico inicial|Entendemos cómo funciona hoy tu empresa.", "Plan de acción|Prioridades claras y medibles.", "Seguimiento mensual|Revisamos avances con tu equipo."], icons: ["search", "list-check", "graph-up-arrow"],
          people: ["Gustavo P.", "Natalia E.", "Ramiro S."], quotes: ["Ordenamos compras y stock. Hoy sabemos dónde está cada peso.", "Nos ayudaron a armar tableros que usamos todas las semanas.", "Un equipo que escucha y baja las ideas a tareas concretas."], orgs: ["Distribuidora", "Fábrica de muebles", "Cadena de cafés", "Estudio contable"],
          closing: "Conversemos sobre tu empresa",
          sections: [
            { m: "servicios-productos-simple", nav: "Servicios", title: "Áreas de trabajo", kicker: "Servicios", items: ["Operaciones|Procesos, tareas y responsables.", "Finanzas|Costos, precios e indicadores.", "Equipos|Roles, reuniones y comunicación."] },
            { m: "imagen-texto-media", title: "Consultoría *que se implementa*", kicker: "Nuestro enfoque", lead: "No dejamos un informe en un cajón. Trabajamos con tu equipo hasta que los cambios funcionan solos.", bullets: ["Diagnóstico en dos semanas", "Tableros de control simples", "Acompañamiento en la implementación"] },
            { m: "cifras-simple", nav: "Resultados", title: "Resultados *que se miden*", items: ["+80|pymes acompañadas", "4 meses|de proyecto promedio", "-18 %|en costos operativos", "9 de 10|clientes vuelven a contratarnos"] },
            { m: "proceso-compleja", nav: "Proceso", title: "Así trabajamos", items: ["Un método probado|Más de 80 pymes acompañadas en los últimos años.", "Diagnóstico|Escuchamos y revisamos datos.", "Prioridades|Elegimos qué resolver primero.", "Implementación|Trabajamos con tu equipo.", "Seguimiento|Medimos y ajustamos."] },
            { m: "casos-exito-media", nav: "Casos", title: "Empresas que crecieron con orden" },
            { m: "marcas-simple", nav: "Clientes", title: "Empresas que confiaron", bullets: ["Distribuidora Sur", "Muebles Arce", "Café Norte", "Estudio Paz", "Logística Delta", "Grupo Andes"] },
            { m: "preguntas-frecuentes-simple", title: "Preguntas frecuentes", items: ["¿Para qué tamaño de empresa trabajan?|Pymes de 5 a 200 personas.", "¿Cuánto dura un proyecto?|Entre tres y seis meses.", "¿Trabajan de forma remota?|Sí, combinamos visitas y reuniones online.", "¿Cómo se cotiza?|Por proyecto, después del diagnóstico."] }
          ] },
        { name: "Estudio creativo", style: "Cobre", font: "editorial", nav: "compleja", hero: "mosaico", footer: "media", tint: "impar",
          image: ["img/servicio-web.jpg", "Espacio de trabajo creativo"],
          photos: [["img/prod-set.jpg", "Packaging diseñado para una marca de cerámica"], ["img/beneficio-foto.jpg", "Dirección de arte para fotografía de producto"], ["img/servicio-web.jpg", "Piezas digitales en pantalla"], ["img/quienes-compleja.jpg", "Equipo revisando bocetos"], ["img/prod-feature.jpg", "Fotografía de producto"], ["img/lugar.jpg", "Identidad aplicada en un local"]],
          title: "Una identidad *que se reconoce*", lead: "Diseño de marca y piezas digitales para negocios con una historia propia.", action: "Contanos tu proyecto", target: "galeria-imagenes",
          highlights: ["Identidad", "Packaging", "Redes"], icons: ["vector-pen", "box-seam", "phone"],
          people: ["Tienda Barro", "Café Norte", "Estudio Luz"], quotes: ["Entendieron la marca mejor que nosotros. El packaging se vende solo.", "Ordenaron nuestra comunicación en redes con un sistema simple.", "Cumplieron cada fecha y el resultado superó lo que imaginábamos."],
          closing: "Hagamos que tu marca se recuerde",
          sections: [
            { m: "galeria-imagenes-media", nav: "Proyectos", title: "Proyectos recientes", items: ["Tienda Barro|Packaging|Packaging", "Café Norte|Fotografía|Fotografía", "Estudio Luz|Digital|Digital", "Sabores Caseros|Identidad|Identidad", "Colección Rituales|Fotografía|Fotografía", "Local Palermo|Espacios|Identidad"] },
            { m: "beneficios-compleja", nav: "Servicios", title: "Diseño para cada etapa", items: ["Identidad|Logo, paleta y pautas de uso.", "Packaging|Envases que cuentan quién sos.", "Dirección de arte|Criterios para fotos y contenido.", "Redes|Plantillas listas para tu equipo."], icons: ["vector-pen", "box-seam", "camera", "phone"] },
            { m: "proceso-media", title: "Cómo trabajamos", items: ["Brief|Conocemos tu marca y tus objetivos.", "Exploración|Propuestas y referencias.", "Diseño|Desarrollamos la opción elegida.", "Entrega|Archivos y guía de uso."] },
            { m: "equipo-simple", title: "El estudio", items: ["|Dirección creativa", "|Diseño y packaging", "|Producción"] },
            { m: "marcas-simple", nav: "Clientes", title: "Marcas con las que trabajamos", bullets: ["Tienda Barro", "Café Norte", "Estudio Luz", "Sabores Caseros", "Rituales", "Casa Olmo"] },
            { m: "resenas-google-compleja", title: "Marcas que trabajaron con nosotros", filters: ["Identidad", "Packaging", "Redes"] }
          ] }
      ]
    },
    {
      id: "mascotas", name: "Animales y mascotas", match: /mascota|veterin|animal|perro|gato/i,
      templates: [
        { name: "Veterinaria de barrio", style: "Menta", font: "moderna", nav: "simple", hero: "media", footer: "compleja",
          image: ["img/plantillas/mascotas.webp", "Veterinaria examinando a un perro"],
          title: "Cuidado cercano *para tu mascota*", lead: "Consultas programadas, controles y orientación para cada etapa.", action: "Pedí un turno", target: "reserva-turno",
          highlights: ["Perros y gatos", "Urgencias", "Peluquería"],
          closing: "Tu mascota en buenas manos",
          sections: [
            { m: "servicios-productos-media", nav: "Servicios", title: "Servicios veterinarios", items: ["Consulta clínica|Evaluación general y seguimiento.", "Vacunación|Esquema según edad y antecedentes.", "Peluquería|Baño y corte con turno."], bullets: ["Control anual", "Análisis", "Receta digital", "Cachorros", "Antirrábica", "Libreta sanitaria", "Baño", "Corte de uñas", "Productos hipoalergénicos"], lead: "Atendemos perros, gatos y animales pequeños." },
            { m: "equipo-simple", title: "El equipo de la veterinaria", items: ["|Clínica de pequeños animales", "|Cirugía", "|Peluquería canina"] },
            { m: "llamado-simple", nav: "Urgencias", title: "¿Tu mascota necesita *atención hoy*?", lead: "Llamanos y te orientamos. Tenemos turnos en el día para urgencias." },
            { m: "beneficios-simple", title: "Por qué elegirnos", kicker: "Beneficios", items: ["Turnos rápidos|En el día para urgencias.", "Historia clínica|Todo registrado.", "Trato amable|Sin estrés para tu mascota.", "Pet shop|Alimento y accesorios."], icons: ["lightning", "file-medical", "heart", "bag-heart"] },
            { m: "preguntas-frecuentes-media", title: "Preguntas frecuentes", items: ["¿Atienden urgencias?|Sí, en horario de atención y con guardia telefónica.", "¿Cada cuánto hay que vacunar?|Te armamos el calendario en la primera consulta.", "¿Hacen visitas a domicilio?|Sí, coordinando con anticipación.", "¿Qué llevo al primer turno?|La libreta sanitaria si la tenés."] },
            { m: "reserva-turno-compleja", nav: "Turnos", title: "Solicitá un turno", services: ["Consulta clínica", "Vacunación", "Peluquería", "Control de cachorro"] },
            { m: "donde-nos-encontramos-simple", title: "Visitanos", items: ["Dirección", "Horarios", "Urgencias|Llamanos y te orientamos."] }
          ] }
      ]
    },
    {
      id: "automotor", name: "Autos y motos", match: /auto|moto|mec[aá]nic|taller|neum[aá]tic/i,
      templates: [
        { name: "Taller mecánico", style: "Grafito", font: "moderna", nav: "media", hero: "compleja", footer: "simple",
          image: ["img/plantillas/automotor.webp", "Mecánico trabajando en un automóvil"],
          photos: [["img/plantillas/automotor.webp", "Taller con un auto en el elevador"]],
          title: "Tu auto, listo *para volver al camino*", lead: "Diagnóstico y mantenimiento con presupuesto antes de intervenir.", action: "Agendá una revisión", target: "reserva-turno",
          highlights: ["Presupuesto previo|No tocamos nada sin tu aprobación.", "Repuestos garantizados|Originales o de primera marca.", "Entrega en el día|En services y frenos."], icons: ["receipt", "shield-check", "clock"],
          people: ["Jorge P.", "Daniela F.", "Esteban R."], quotes: ["Me explicaron la falla con fotos y el presupuesto fue el acordado.", "Service rápido y a buen precio. Ya es mi taller de confianza.", "Me resolvieron un ruido que otros talleres no encontraban."],
          closing: "Tu auto en manos de confianza",
          sections: [
            { m: "lista-precios-simple", nav: "Precios", title: "Precios de referencia", kicker: "Servicios", items: ["Service básico|Aceite, filtro y revisión de 20 puntos.||Desde $85.000", "Pastillas de freno|Cambio y control de discos.||Desde $60.000", "Diagnóstico computarizado|Escaneo y reporte de fallas.||$25.000", "Alineación y balanceo|Las cuatro ruedas.||$35.000", "Cambio de batería|Con prueba del sistema de carga.||Desde $20.000", "Revisión para la VTV|Luces, frenos y emisiones.||$30.000"] },
            { m: "proceso-media", title: "Cómo trabajamos", items: ["Recibimos|Escuchamos qué le pasa al auto.", "Diagnosticamos|Revisión y escaneo.", "Presupuestamos|Te mandamos el detalle por WhatsApp.", "Entregamos|Con el informe del trabajo."] },
            { m: "resenas-google-simple", title: "Clientes que vuelven" },
            { m: "preguntas-frecuentes-simple", title: "Preguntas frecuentes", items: ["¿Trabajan con todas las marcas?|Sí, nacionales e importadas.", "¿Tienen garantía?|Seis meses en mano de obra.", "¿Puedo esperar el auto?|En services, sí. Tenemos sala de espera.", "¿Aceptan tarjetas?|Débito, crédito y transferencia."] },
            { m: "reserva-turno-media", nav: "Turnos", title: "Agendá tu turno *en el taller*", lead: "Elegí el día y dejá el auto a primera hora." },
            { m: "donde-nos-encontramos-compleja", title: "Dónde está el taller", items: ["Fácil de encontrar|Sobre la avenida, con portón amplio.", "Transporte público|Colectivos a media cuadra.", "Si venís en auto|Dejalo en el taller y te acercamos."] }
          ] }
      ]
    },
    {
      id: "fotografia", name: "Diseño y fotografía", match: /fot[oó]graf|dise[nñ]o|video|audiovisual/i,
      templates: [
        { name: "Fotografía de estudio", style: "Topo", font: "clasica", nav: "compleja", hero: "mosaico", footer: "compleja",
          image: ["img/plantillas/fotografia.webp", "Fotógrafa trabajando en un estudio luminoso"],
          photos: [["img/prod-feature.jpg", "Fotografía de producto sobre piedra"], ["img/galx-main.jpg", "Fotografía de interiores"], ["img/quienes-compleja.jpg", "Retrato de equipo"], ["img/prod-set.jpg", "Bodegón de cerámica"], ["img/galx-calidez.jpg", "Interior cálido"], ["img/beneficio-foto.jpg", "Naturaleza muerta"], ["img/galx-th3.jpg", "Dormitorio para catálogo"], ["img/plantillas/fotografia.webp", "Sesión en el estudio"], ["img/galx-pausa.jpg", "Detalle de producto textil"]],
          title: "Fotos para contar *lo que hacés*", lead: "Retratos profesionales, productos y campañas con dirección de arte.", action: "Ver portfolio", target: "galeria-imagenes",
          people: ["Marina C.", "Bruno S.", "Clara D."], quotes: ["Las fotos de producto duplicaron las consultas en la tienda.", "Me sentí cómoda en la sesión de retratos desde el primer minuto.", "Entregaron en tiempo y con una edición impecable."],
          highlights: ["Dirección de arte|Cada sesión con un plan visual."], icons: ["camera"],
          closing: "Hagamos tu próxima sesión",
          sections: [
            { m: "galeria-imagenes-compleja", nav: "Portfolio", title: "Portfolio", items: ["Colección Rituales", "Casa del bosque", "Equipo Norte", "Bodegón en piedra", "Hotel Sereno", "Naturaleza muerta", "Catálogo textil", "Sesión de estudio", "Detalle de producto"], kicker: "Trabajos", filters: ["Producto", "Interiores", "Retratos"], lead: "Una selección de sesiones de los últimos meses." },
            { m: "lista-precios-media", nav: "Sesiones", title: "Sesiones y *paquetes*", kicker: "Tarifas", lead: "Cada paquete incluye edición profesional y entrega en alta.", items: ["Retrato profesional|Una hora, diez fotos editadas.||$120.000", "Producto|Hasta 15 productos con fondo a elección.||$180.000", "Interiores|Recorrido completo con luz natural.||$220.000", "Campaña|Jornada completa con dirección de arte.||A cotizar"], images: [["img/plantillas/fotografia.webp", "Sesión de fotos en el estudio"]] },
            { m: "proceso-simple", title: "De la idea a la entrega", items: ["Brief|Objetivo y referencias.", "Sesión|Luz, encuadre y dirección.", "Entrega|Selección y edición final."] },
            { m: "casos-exito-simple", title: "Clientes que confiaron" },
            { m: "preguntas-frecuentes-compleja", title: "Preguntas frecuentes", filters: ["Sesiones", "Entregas", "Pagos"], items: ["¿Dónde son las sesiones?|En el estudio o en tu espacio.", "¿Puedo llevar mi ropa?|Sí, te sugerimos cambios y colores.", "¿Cuándo recibo las fotos?|Entre cinco y diez días hábiles.", "¿En qué formato entregan?|JPG en alta y versión para redes.", "¿Cómo se reserva?|Con una seña del 30 %.", "¿Puedo reprogramar?|Con 48 horas de aviso."] }
          ] }
      ]
    },
    {
      id: "cultura", name: "Arte y cultura", match: /galer[ií]a|museo|arte|cultura|teatro/i,
      templates: [
        { name: "Galería de arte", style: "Berenjena", font: "editorial", nav: "simple", hero: "centrada", footer: "media", tint: "impar",
          image: ["img/plantillas/cultura.webp", "Visitante frente a obras en una galería"],
          photos: [["img/plantillas/cultura.webp", "Sala de exposición"], ["img/galx-ideas.jpg", "Obra sobre papel junto a la ventana"], ["img/galx-th1.jpg", "Instalación con plantas"]],
          title: "El arte *se encuentra en persona*", lead: "Exposiciones, recorridos y conversaciones para descubrir nuevas miradas.", action: "Ver la programación", target: "agenda",
          highlights: ["Entrada libre", "Visitas guiadas", "Charlas con artistas"],
          people: ["Elena V.", "Tomás H.", "Grupo escolar"], quotes: ["La visita guiada cambió mi forma de mirar las obras.", "Un espacio cuidado, con muestras que invitan a volver.", "Llevamos a los chicos y salieron llenos de preguntas."],
          closing: "Te esperamos en sala",
          sections: [
            { m: "video-destacado-simple", nav: "Muestra", title: "Recorré la muestra actual", images: [["img/plantillas/cultura.webp", "Fotograma del recorrido por la muestra"]] },
            { m: "agenda-simple", nav: "Agenda", title: "Programación", kicker: "Agenda", items: ["Inauguración «Tierra adentro»|Muestra colectiva de pintura. Viernes a las 19 h.|13 dic", "Visita guiada|Recorrido con la curadora. Sábado a las 17 h.|14 dic", "Charla con artistas|Procesos y obra en diálogo. Jueves a las 19 h.|19 dic"] },
            { m: "galeria-imagenes-simple", title: "Obras en sala" },
            { m: "quienes-somos-compleja", nav: "La galería", title: "Un espacio para *artistas emergentes*", lead: "Desde 2015 mostramos el trabajo de artistas que están empezando a exponer.", items: ["Qué buscamos|Obras que abran preguntas y dialoguen con el barrio.", "Cómo participar|Convocatoria abierta dos veces por año."] },
            { m: "resenas-google-media", title: "Lo que dicen nuestros visitantes" },
            { m: "donde-nos-encontramos-media", title: "Visitá la galería" }
          ] }
      ]
    },
    {
      id: "electronica", name: "Electrónica", match: /electr[oó]nica|audio|accesorios|celular|gadget/i,
      templates: [
        { name: "Audio y accesorios", style: "Azul eléctrico", font: "moderna", nav: "media", hero: "compleja", footer: "compleja",
          image: ["img/plantillas/electronica.webp", "Auriculares y accesorios electrónicos sobre un escritorio"],
          title: "Equipá tu día *con lo que usás*", lead: "Audio y accesorios elegidos para trabajar, estudiar y escuchar música.", action: "Ver categorías", target: "servicios-productos",
          highlights: ["Envío en 24 h|En CABA y GBA.", "Garantía oficial|12 meses en todos los productos.", "Asesoramiento|Te ayudamos a elegir."], icons: ["truck", "shield-check", "chat-dots"],
          people: ["Fran L.", "Mica O.", "Seba T."], quotes: ["Me asesoraron por WhatsApp y los auriculares son justo lo que buscaba.", "Llegó al otro día, bien embalado.", "Buenos precios y atención rápida cuando tuve una duda."],
          closing: "Encontrá tu próximo equipo",
          sections: [
            { m: "beneficios-media", nav: "Ventajas", title: "Comprá con tranquilidad", items: ["Productos originales|Importadores oficiales.", "Cuotas sin interés|Con todas las tarjetas.", "Cambios simples|30 días para cambiar.", "Retiro en local|Sin costo de envío."] },
            { m: "marcas-simple", nav: "Marcas", title: "Marcas oficiales", bullets: ["Sony", "JBL", "Logitech", "Philips", "Xiaomi", "Samsung"] },
            { m: "servicios-productos-media", nav: "Categorías", title: "Qué podés encontrar", items: ["Auriculares|Para oficina, deporte y gaming.", "Parlantes|Portátiles y para el hogar.", "Accesorios|Cables, cargadores y soportes."], bullets: ["Con cancelación de ruido", "Inalámbricos", "Con micrófono", "Bluetooth", "Resistentes al agua", "Con batería larga", "USB-C", "Carga rápida", "Soportes de escritorio"], lead: "¿Buscás algo puntual? Consultanos." },
            { m: "resenas-google-compleja", title: "Lo que dicen nuestros clientes", filters: ["Envíos", "Atención", "Productos"] },
            { m: "preguntas-frecuentes-media", title: "Consultas de compra", items: ["¿Cómo verifico la compatibilidad?|Mandanos el modelo de tu dispositivo.", "¿Hacen factura A?|Sí, pedila al comprar.", "¿Cuánto tarda el envío?|24 a 72 horas según la zona.", "¿Puedo retirar mi pedido?|Sí, en el local con tu número de orden."] },
            { m: "donde-nos-encontramos-simple", title: "Retirá en el local", items: ["Local", "Horarios", "Retiros|Te avisamos cuando tu pedido esté listo."] }
          ] }
      ]
    },
    {
      id: "hogar", name: "Hogar y familia", match: /hogar|familia|electric|mantenimiento|decoraci|interior/i,
      templates: [
        { name: "Electricidad para el hogar", style: "Canela", font: "clasica", nav: "compleja", hero: "datos", footer: "simple",
          image: ["img/plantillas/hogar.webp", "Electricista trabajando en una vivienda"],
          photos: [["img/plantillas/hogar.webp", "Revisión de un tablero eléctrico"]],
          title: "Instalaciones eléctricas *para tu casa*", lead: "Revisión, diagnóstico y reparaciones coordinadas con presupuesto previo.", action: "Pedí presupuesto", target: "proceso",
          highlights: ["Matriculados|Electricistas habilitados.", "Urgencias 24 h|Guardia en CABA y zona norte.", "Garantía escrita|Seis meses por el trabajo."],
          people: ["Mónica R.", "Carlos D.", "Laura P."], quotes: ["Vinieron el mismo día por un corte y lo resolvieron rápido.", "Me cambiaron el tablero completo y dejaron todo limpio.", "Presupuesto claro y trabajo prolijo."],
          closing: "Una instalación segura empieza con una revisión",
          sections: [
            { m: "servicios-productos-simple", nav: "Servicios", title: "Trabajos a domicilio", kicker: "Servicios", items: ["Iluminación|Instalación y renovación de luminarias.", "Tableros|Actualización con disyuntor y térmicas.", "Diagnóstico|Buscamos la falla y te explicamos opciones."] },
            { m: "beneficios-compleja", title: "Trabajos seguros y prolijos", items: ["Matrícula vigente|Electricistas habilitados.", "Materiales certificados|Normas IRAM.", "Limpieza|Dejamos todo como estaba.", "Garantía|Seis meses por escrito."], icons: ["patch-check", "plug", "stars", "shield-check"] },
            { m: "proceso-compleja", nav: "Cómo trabajamos", title: "Cómo coordinamos la visita", items: ["Sin sorpresas|Antes de empezar sabés qué se hace y cuánto cuesta.", "Consultá|Contanos el problema.", "Agendá|Elegí una franja horaria.", "Presupuesto|Lo aprobás antes de empezar.", "Trabajo|Con garantía escrita."] },
            { m: "llamado-media", nav: "Urgencias", title: "¿Se cortó la luz? *Te ayudamos hoy*", lead: "Guardia de urgencias las 24 horas en CABA y zona norte." },
            { m: "resenas-google-simple", title: "Vecinos que nos recomiendan" },
            { m: "preguntas-frecuentes-simple", title: "Preguntas frecuentes", items: ["¿Cobran la visita?|Se descuenta si hacemos el trabajo.", "¿Atienden urgencias?|Sí, las 24 horas.", "¿Emiten certificados?|Sí, para consorcios y aseguradoras.", "¿En qué zonas trabajan?|CABA y zona norte."] }
          ] },
        { name: "Decoración de interiores", style: "Terracota", font: "editorial", nav: "simple", hero: "dividida", footer: "compleja", tint: "impar",
          image: ["img/galx-main.jpg", "Living abierto con ventanales al jardín"],
          photos: [["img/galx-calidez.jpg", "Rincón de estar con luz cálida"], ["img/galx-th2.jpg", "Cocina con isla de madera"], ["img/galx-th3.jpg", "Dormitorio en tonos claros"], ["img/galx-living.jpg", "Living y dormitorio integrados"], ["img/galx-ideas.jpg", "Escritorio junto a la ventana"], ["img/galx-pausa.jpg", "Sillón de lectura con manta"], ["img/galx-th4.jpg", "Sillón frente a un paisaje verde"], ["img/galx-th1.jpg", "Detalle de living con plantas"], ["img/galx-main.jpg", "Living abierto al jardín"]],
          title: "Espacios que *se sienten tuyos*", lead: "Proyectos de interiorismo para casas y departamentos, de la idea a la obra terminada.", action: "Agendá una visita", target: "reserva-turno",
          highlights: ["Proyecto integral", "Renders antes de comprar"],
          people: ["Familia Giménez", "Andrea L.", "Pablo y Juli"], quotes: ["Transformaron un departamento oscuro en el lugar donde más nos gusta estar.", "Respetaron el presupuesto y los tiempos de obra.", "Cada mueble tiene sentido. Es nuestra casa, pero mejor."], orgs: ["Departamento", "Casa", "Monoambiente"],
          closing: "Tu casa puede sentirse distinta",
          sections: [
            { m: "galeria-imagenes-compleja", nav: "Proyectos", title: "Proyectos terminados", items: ["Casa en Belgrano", "Rincón de estar", "Cocina en roble", "Dormitorio sereno", "Loft en Palermo", "Escritorio en casa", "Rincón de lectura", "Vista al jardín", "Living con plantas"], kicker: "Galería", filters: ["Livings", "Cocinas", "Dormitorios"], lead: "Casas reales, pensadas con luz natural y materiales nobles." },
            { m: "quienes-somos-media", nav: "Estudio", title: "Diseñamos *con vos*", items: ["Escuchamos cómo vivís|Cada proyecto empieza conociendo tus rutinas, tus objetos y lo que querés cambiar.", "Luz|Aprovechar cada ventana.", "Materiales|Nobles y duraderos.", "Orden|Lugar para cada cosa."], images: [["img/galx-calidez.jpg", "Living cálido diseñado por el estudio"]], lead: "Somos un estudio de interiorismo con foco en casas que se usan todos los días.", body: ["Te acompañamos desde el primer boceto hasta la última lámpara."] },
            { m: "cifras-simple", nav: "Trayectoria", title: "Casas que *cambiaron*", items: ["+120|proyectos terminados", "10|años de estudio", "8 semanas|de obra promedio", "4,9|de puntaje en Google"] },
            { m: "proceso-media", title: "De la idea a la obra", items: ["Visita|Conocemos el espacio.", "Propuesta|Planos, renders y presupuesto.", "Compras|Elegimos muebles y materiales.", "Obra|Coordinamos a cada gremio."] },
            { m: "casos-exito-media", title: "Clientes en su nueva casa" },
            { m: "reserva-turno-media", nav: "Visitas", title: "Agendá una *visita al espacio*", lead: "Elegí un horario y vamos a conocer tu casa." }
          ] }
      ]
    },
    {
      id: "regalos", name: "Regalos y flores", match: /regalo|flor|fiesta|cer[aá]mic|deco/i,
      templates: [
        { name: "Florería de estación", style: "Frambuesa", font: "editorial", nav: "media", hero: "mosaico", footer: "media",
          image: ["img/plantillas/regalos.webp", "Florista preparando un ramo de flores"],
          photos: [["img/plantillas/regalos.webp", "Ramo de flores de estación"], ["img/galx-th1.jpg", "Arreglo floral en un living"]],
          title: "Flores para decirlo *a tu manera*", lead: "Ramos por encargo, arreglos para eventos y regalos con dedicatoria.", action: "Encargá tu ramo", target: "lista-precios",
          highlights: ["Envío en el día|Ramos armados a mano cada mañana."], icons: ["flower1"],
          closing: "Mandá flores hoy",
          sections: [
            { m: "lista-precios-simple", nav: "Ramos", title: "Ramos y precios", kicker: "Encargos", items: ["Ramo chico|Flores de estación en papel reciclado.||$18.000", "Ramo mediano|Combinación de seis variedades.||$28.000", "Ramo grande|Para celebrar en grande.||$42.000", "Caja de rosas|Doce rosas con tarjeta.||$35.000", "Centro de mesa|Para eventos y cenas especiales.||$22.000", "Suscripción|Un ramo por semana en tu casa.||$90.000 al mes"] },
            { m: "quienes-somos-simple", nav: "Nosotras", title: "Flores que *cuentan algo*", kicker: "Quiénes somos", lead: "Somos un taller floral de barrio. Compramos en el mercado cada mañana y armamos cada ramo a pedido.", body: ["Nada de plástico ni flores teñidas: solo lo que da la estación.", "Flores frescas. Envíos en el día."] },
            { m: "beneficios-simple", title: "Por qué elegirnos", kicker: "Beneficios", items: ["Frescura|Flores compradas en el día.", "Envío|En moto, en dos horas.", "Dedicatoria|Escrita a mano.", "Seguimiento|Te avisamos cuando llega."], icons: ["flower1", "scooter", "pencil", "bell"] },
            { m: "preguntas-frecuentes-compleja", title: "Cómo hacer tu pedido", filters: ["Pedidos", "Envíos", "Pagos"], items: ["¿Puedo elegir los colores?|Sí, según la disponibilidad de la semana.", "¿Con cuánto tiempo encargo?|Con 24 horas alcanza para ramos.", "¿Hacen envíos?|Sí, en el día en toda la ciudad.", "¿Cuánto cuesta el envío?|Depende de la zona.", "¿Cómo pago?|Transferencia, tarjeta o Mercado Pago.", "¿Entregan factura?|Sí, pedila al encargar."] },
            { m: "donde-nos-encontramos-compleja", title: "Visitá el taller", images: [["img/plantillas/regalos.webp", "Taller floral"]], items: ["Un taller lleno de color|Pasá a elegir las flores en persona.", "Transporte público|A una cuadra del subte.", "Retiro en el local|Coordinamos el horario."] }
          ] },
        { name: "Tienda de cerámica", style: "Oliva", font: "clasica", nav: "compleja", hero: "compleja", footer: "compleja", tint: "impar",
          image: ["img/prod-feature.jpg", "Taza, cuenco y florero sobre una bandeja de piedra"],
          photos: [["img/prod-set.jpg", "Set de piezas de cerámica"], ["img/prod-taza.jpg", "Taza de cerámica clara"]],
          title: "Piezas hechas a mano *para regalar*", lead: "Vajilla y objetos de cerámica de producción artesanal, con envío a todo el país.", action: "Ver la colección", target: "productos",
          highlights: ["Hecho a mano|Cada pieza es única.", "Envío protegido|Embalaje que cuida tus piezas.", "Listo para regalar|Con caja y tarjeta."], icons: ["hand-index-thumb", "box-seam", "gift"],
          people: ["Valen G.", "Martina S.", "Hugo B."], quotes: ["Regalé el set de tazas y fue un éxito. Llegó perfecto.", "Se nota el trabajo artesanal en cada pieza.", "Atención muy cálida y envío rápido."],
          closing: "Regalá algo hecho a mano",
          sections: [
            { m: "productos-media", nav: "Colección", title: "Encontrá tu *próximo favorito*", filters: ["Vajilla", "Decoración", "Regalos"], items: ["Taza Serena", "Florero Aura", "Cuenco Tierra"], images: [["img/prod-taza-m.jpg", "Taza de dos tonos"], ["img/prod-florero-m.jpg", "Florero de dos tonos"], ["img/prod-cuenco-m.jpg", "Cuenco de dos tonos"]] },
            { m: "imagen-texto-simple", nav: "El taller", title: "Del torno *a tu mesa*", kicker: "El taller", lead: "Cada pieza se modela, esmalta y hornea en nuestro taller. Por eso no hay dos iguales.", images: [["img/prod-set.jpg", "Piezas recién salidas del horno"]] },
            { m: "beneficios-media", title: "Comprar en el taller", items: ["Producción local|Arcilla y esmaltes nacionales.", "Envíos a todo el país|Embalaje reforzado.", "Para regalar|Caja y tarjeta sin costo.", "Pedidos especiales|Sets para casamientos y empresas."] },
            { m: "llamado-simple", nav: "Encargos", title: "¿Buscás un regalo *especial*?", lead: "Armamos sets a medida para casamientos, empresas y fechas especiales.", action: "Consultá por encargos" },
            { m: "resenas-google-simple", title: "Lo que dicen quienes compraron" },
            { m: "preguntas-frecuentes-media", title: "Antes de comprar", items: ["¿Las piezas van al lavavajillas?|Sí, y también al microondas.", "¿Hacen envíos?|A todo el país por correo.", "¿Puedo encargar un set?|Sí, con dos semanas de anticipación.", "¿Qué pasa si llega rota?|La reponemos sin costo."] }
          ] }
      ]
    },
    {
      id: "comunidad", name: "Sociedad y comunidad", match: /comunidad|fundaci[oó]n|ong|social|voluntar/i,
      templates: [
        { name: "Red de voluntariado", style: "Eucalipto", font: "moderna", nav: "simple", hero: "compleja", footer: "compleja",
          image: ["img/plantillas/comunidad.webp", "Personas voluntarias clasificando donaciones"],
          photos: [["img/plantillas/comunidad.webp", "Jornada de voluntariado"], ["img/equipo-grupo.jpg", "Equipo de coordinación"]],
          title: "Sumá tiempo *a una causa cercana*", lead: "Conectamos personas y organizaciones para sostener acciones en el barrio.", action: "Quiero sumarme", target: "proceso",
          highlights: ["Jornadas de 3 horas|Elegís cuándo participar.", "Sin experiencia|Te acompañamos desde el primer día.", "Impacto local|Ayudás en tu barrio."], icons: ["clock", "hand-thumbs-up", "geo-alt"],
          people: ["Camila R.", "Joaquín M.", "Rosa T."], quotes: ["Empecé una vez por mes y hoy coordino el ropero comunitario.", "Conocí gente increíble y siento que ayudo de verdad.", "Una organización seria, transparente y muy humana."], orgs: ["Voluntaria", "Voluntario", "Vecina"],
          closing: "Tu tiempo puede cambiar algo",
          sections: [
            { m: "proceso-compleja", nav: "Sumate", title: "Cómo sumarte", items: ["Empezar es simple|Elegís una actividad y te acompañamos en la primera jornada.", "Elegí|Una tarea según tus intereses.", "Coordiná|Día y horario.", "Participá|Con el equipo.", "Seguí|Con la frecuencia que puedas."] },
            { m: "quienes-somos-media", nav: "Nosotros", title: "Una red *de vecinos*", items: ["Desde 2012 en el barrio|Organizamos colectas, apoyo escolar y comedores con más de 300 voluntarios.", "Cercanía|Trabajamos donde vivimos.", "Transparencia|Rendimos cuentas.", "Constancia|Todas las semanas."], lead: "Nacimos como un grupo de vecinos que quería ayudar en el comedor de la parroquia.", body: ["Hoy articulamos con escuelas, clubes y centros de salud."] },
            { m: "cifras-media", nav: "Impacto", title: "Lo que logramos *juntos*", lead: "Cada jornada suma. Esto hicimos el último año.", items: ["+300|voluntarios activos", "12.000|viandas entregadas", "85|chicos en apoyo escolar", "14|organizaciones aliadas"] },
            { m: "agenda-simple", nav: "Jornadas", title: "Próximas jornadas", kicker: "Agenda", items: ["Colecta de útiles|Sábado de 10 a 14 h en la plaza.|14 dic", "Cena solidaria|Viernes a las 20 h. Cocinamos para 200 personas.|20 dic", "Apoyo escolar de verano|De lunes a jueves, de 9 a 12 h.|13 ene"] },
            { m: "casos-exito-simple", title: "Historias de voluntarios" },
            { m: "preguntas-frecuentes-simple", title: "Preguntas de voluntariado", items: ["¿Necesito experiencia?|No, cada actividad tiene una capacitación.", "¿Puedo participar en familia?|Sí, hay jornadas para todas las edades.", "¿Puedo donar?|Sí, ropa, alimentos o dinero.", "¿Entregan certificados?|Sí, de horas de voluntariado."] },
            { m: "donde-nos-encontramos-media", title: "Dónde nos juntamos" }
          ] }
      ]
    },
    {
      id: "tecnologia", name: "Computación e internet", match: /tecnolog|software|internet|sistemas|app|saas/i,
      templates: [
        { name: "Software para equipos", style: "Azul tinta", font: "moderna", nav: "media", hero: "marco", footer: "compleja", tint: "impar",
          image: ["img/plantillas/tecnologia.webp", "Desarrollador trabajando frente a una computadora"],
          photos: [["img/plantillas/tecnologia.webp", "Tablero de tareas en pantalla"], ["img/servicio-web.jpg", "La plataforma en una notebook"], ["img/equipo-grupo.jpg", "Equipo usando la plataforma"]],
          title: "Organizá el trabajo *en un solo lugar*", lead: "Una plataforma para centralizar tareas, responsables y avances del equipo.", action: "Probá gratis 14 días", target: "proceso",
          highlights: ["Sin tarjeta", "En español", "Soporte humano"],
          people: ["Agencia Prisma", "Logística Sur", "Estudio Norte"], quotes: ["Dejamos las planillas y ahora todos saben qué hacer cada día.", "La implementación fue en una tarde. El soporte responde rápido.", "Los reportes semanales nos ahorran una reunión entera."],
          closing: "Empezá a ordenar tu equipo hoy",
          sections: [
            { m: "beneficios-compleja", nav: "Funciones", title: "Funciones para el día a día", items: ["Tableros|Ordená pendientes por etapa.", "Responsables|Asigná tareas y fechas.", "Reportes|Avance semanal automático.", "Permisos|Qué ve cada rol."], icons: ["kanban", "person-check", "bar-chart", "shield-lock"] },
            { m: "cifras-simple", nav: "Resultados", title: "Equipos que *ganan tiempo*", items: ["+2.500|equipos activos", "4 h|ahorradas por semana", "99,9 %|de disponibilidad", "14 días|de prueba gratis"] },
            { m: "video-destacado-media", nav: "Demos", title: "Mirá cómo funciona", items: ["Primeros pasos|Tutorial|Tutorial", "Tableros y tareas|Funciones|Funciones", "Reportes automáticos|Funciones|Reportes"] },
            { m: "proceso-simple", nav: "Empezar", title: "Así empezás", items: ["Creá un espacio|Tu primer proyecto en minutos.", "Invitá al equipo|Accesos y responsables.", "Seguí avances|Tablero y reportes."] },
            { m: "resenas-google-compleja", title: "Equipos que ya lo usan", filters: ["Soporte", "Facilidad", "Reportes"] },
            { m: "marcas-simple", nav: "Clientes", title: "Confían en nosotros", bullets: ["Agencia Prisma", "Logística Sur", "Estudio Norte", "Grupo Delta", "Nube Viajes", "Casa Olmo"] },
            { m: "preguntas-frecuentes-compleja", title: "Preguntas frecuentes", filters: ["Prueba", "Planes", "Seguridad"], items: ["¿La prueba es gratis?|Sí, 14 días sin tarjeta.", "¿Puedo importar mis planillas?|Sí, desde Excel o Google Sheets.", "¿Cuánto cuesta?|Desde USD 6 por usuario por mes.", "¿Hay descuento anual?|Sí, dos meses sin cargo.", "¿Dónde se guardan los datos?|En servidores con copias diarias.", "¿Puedo exportar todo?|Sí, cuando quieras."] }
          ] }
      ]
    },
    {
      id: "deportes", name: "Deportes y aire libre", match: /deporte|aire libre|trekking|running|club|outdoor/i,
      templates: [
        { name: "Club de trekking", style: "Bosque", font: "editorial", nav: "compleja", hero: "simple", footer: "simple",
          image: [V + "cat-aventura.webp", "Paisaje para actividades de aventura"],
          photos: [[V + "hero-2.webp", "Caminante frente a un cordón de montañas"], [V + "dest-bariloche.webp", "Lago entre montañas"], [V + "promo-salta.webp", "Quebrada de colores"], [V + "promo-ushuaia.webp", "Montañas nevadas junto al canal"], [V + "cat-aventura.webp", "Cumbre nevada al sol"]],
          title: "La próxima caminata *empieza acá*", lead: "Salidas guiadas para conocer senderos y compartir el recorrido.", action: "Anotate a una salida", target: "reserva-turno",
          closing: "Nos vemos en el sendero",
          sections: [
            { m: "galeria-imagenes-media", nav: "Salidas", title: "Senderos que recorrimos", items: ["Bosque de lengas|Sur|Bosque", "Lago escondido|Bariloche|Lagos", "Quebrada de colores|Norte|Montaña", "Glaciar Martial|Ushuaia|Montaña", "Mirador del valle|Córdoba|Valles", "Cumbre al amanecer|Mendoza|Montaña"] },
            { m: "agenda-media", nav: "Calendario", title: "Próximas salidas", items: ["Cerro López|Nivel intermedio. Traslado desde Bariloche.|Sáb 14 dic · 8 h", "Laguna Negra|Nivel inicial. Jornada completa.|Dom 22 dic · 7 h", "Travesía Jakob|Nivel avanzado. Dos días con refugio.|Sáb 11 ene · 6 h"] },
            { m: "servicios-productos-simple", nav: "Niveles", title: "Salidas por nivel", kicker: "Niveles", items: ["Inicial|Recorridos cortos con paradas.", "Intermedio|Desnivel y mayor distancia.", "Avanzado|Jornada completa con requisitos."] },
            { m: "equipo-simple", title: "Guías del club", items: ["|Guía de montaña certificada", "|Primeros auxilios en zonas agrestes", "|Coordinación de salidas"] },
            { m: "preguntas-frecuentes-media", title: "Antes de salir", items: ["¿Qué equipo necesito?|Zapatillas de trekking, abrigo en capas y agua.", "¿Incluye traslado?|En las salidas fuera de la ciudad, sí.", "¿Qué pasa si llueve?|Reprogramamos sin costo.", "¿Hay seguro?|Sí, cada salida incluye seguro."] },
            { m: "reserva-turno-media", nav: "Anotate", title: "Reservá tu lugar *en la próxima salida*", lead: "Elegí la fecha y te mandamos el detalle por mail." }
          ] }
      ]
    },
    {
      id: "entretenimiento", name: "Entretenimiento y vida nocturna", match: /entretenimiento|m[uú]sica|evento|juego|nocturn|bar\b/i,
      templates: [
        { name: "Ciclo de música en vivo", style: "Berenjena", font: "moderna", nav: "media", hero: "centrada", footer: "compleja", tint: "impar",
          image: ["img/plantillas/entretenimiento.webp", "Escenario de un concierto con luces azules y violetas"],
          title: "Una noche para *escuchar en vivo*", lead: "Artistas emergentes, sesiones acústicas y fechas para agendar.", action: "Ver la agenda", target: "agenda",
          highlights: ["Viernes y sábados|Shows desde las 21 h.", "Barra y cocina|Abiertas toda la noche.", "Entradas anticipadas|Con descuento."], icons: ["calendar-event", "cup-straw", "ticket-perforated"],
          people: ["Juli A.", "Manu D.", "Paz G."], quotes: ["El sonido es increíble y el lugar es muy íntimo.", "Descubrí bandas que hoy escucho todo el tiempo.", "Gran ambiente para ir con amigos un viernes."],
          closing: "Agendá tu próxima noche",
          sections: [
            { m: "video-destacado-simple", nav: "En vivo", title: "Así se vive una noche", images: [["img/plantillas/entretenimiento.webp", "Fotograma de un show en vivo"]] },
            { m: "agenda-simple", nav: "Agenda", title: "Próximas fechas", kicker: "Cartelera", items: ["Noche acústica|Trío Brisa y Ana Sol. Puertas a las 20 h.|12 dic", "Rock en la sala|Los Faros e invitados. Puertas a las 21 h.|13 dic", "Jazz de sábado|Cuarteto Delta. Puertas a las 21 h.|14 dic"] },
            { m: "resenas-google-media", title: "Lo que dice el público" },
            { m: "preguntas-frecuentes-simple", title: "Antes del show", items: ["¿A qué hora abren las puertas?|Una hora antes de cada show.", "¿Cómo reservo mesa?|Con la compra anticipada.", "¿Hay edad mínima?|Mayores de 18.", "¿Puedo tocar en el ciclo?|Mandanos tu material."] },
            { m: "llamado-media", nav: "Entradas", title: "Asegurá tu lugar *para el viernes*", lead: "Las entradas anticipadas tienen descuento y mesa garantizada.", action: "Comprá tu entrada" },
            { m: "donde-nos-encontramos-compleja", title: "Dónde es el ciclo", images: [["img/plantillas/entretenimiento.webp", "Sala del ciclo de música"]], items: ["Una sala con historia|Capacidad para 150 personas.", "Transporte público|Subte y colectivos hasta tarde.", "Si venís en auto|Estacionamiento a una cuadra."] }
          ] }
      ]
    }
  ];
})();
