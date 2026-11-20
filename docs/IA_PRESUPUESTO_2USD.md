# Lanzate — IA centralizada con presupuesto de US$ 2

## Configuración establecida

- Presupuesto mensual interno: **US$ 2** (200 centavos, mes UTC).
- Alerta: **50%** (US$ 1). Aparece en `GET /api/ia`, no envía correos.
- Automatización: activa para las funciones existentes; no llama a IA por escribir o guardar.
- Caché: activa, por proveedor/modelo/entrada e imágenes (hash SHA-256). Redis: TTL de 30 días.
- Bloqueo: activo; reserva atómica en Redis antes de llamar a Anthropic/OpenAI.
- Texto: reserva inicial de US$ 0,25 por llamada. Imágenes: US$ 0,75. Ajusta por consumo reportado cuando es inferior a la reserva.
- Texto máximo por consulta: 8.000 caracteres entre sistema y solicitud; respuesta máxima: 2.000 tokens.
- Las claves **nunca** se mandan ni guardan desde el navegador.

## Pasos de despliegue (Vercel)

1. En **Vercel → Project Settings → Environment Variables**, configurar `ANTHROPIC_API_KEY` (o `OPENAI_API_KEY`) exclusivamente en el servidor, para el entorno correspondiente. **No** usar variables prefijadas `NEXT_PUBLIC_` ni `VITE_`.
2. Configurar Redis Upstash persistente: `KV_REST_API_URL` y `KV_REST_API_TOKEN` (o equivalentes con prefijo reconocidos por el backend). Sin Redis en Vercel, las llamadas quedan bloqueadas.
3. Elegir un modelo válido, de costo reducido, en `LANZATE_IA_MODEL`. Verificar los nombres disponibles en el proveedor antes de desplegar.
4. Configurar tasas conservadoras para estimación del consumo (USD por millón de tokens): `LANZATE_IA_INPUT_USD_M` y `LANZATE_IA_OUTPUT_USD_M`. Los valores de respaldo 5 y 25 **no representan precios actuales verificados**; revisarlos para el modelo elegido.
5. Establecer además un **límite de gasto del lado del proveedor**, si está disponible, y alertas de facturación. El control interno no garantiza un tope exacto en la factura si las tarifas o tokens de imagen/caché difieren del cálculo.
6. Ejecutar `python scripts/test-ai-budget.py`, las pruebas existentes, desplegar primero en Preview y después de validar, pasar a producción.

## Política de fallo seguro

- Si Redis o la clave faltan, **no se llama al proveedor de IA**.
- Si una llamada a la IA falla, intenta liberar la reserva; si Redis no responde, mantiene la reserva bloqueada para evitar gastos imprevistos.
- Si falla guardar la caché, devuelve el resultado sin una segunda consulta.
- Los accesos a `/api/ia` siguen protegidos por la sesión del equipo; no se habilita IA desde el portal público.

## Limitaciones antes de producción

El saldo mostrado es **consumo estimado/reservado**, no facturación oficial ni medición exacta. La reserva predeterminada puede ser insuficiente para ciertos modelos o imágenes. Validar tarifas reales, tokens de entrada/salida, imágenes y límites externos. Se deben impedir llamadas simultáneas duplicadas por la misma entrada si se quiere un ahorro adicional; actualmente las reservas son atómicas pero la caché no coordina solicitudes idénticas en vuelo. Por seguridad, no fusionar automáticamente sin pruebas y confirmación de variables.
