# WheelLive — Configuración de OBS / TikTok Live Studio

## Browser Source

1. Agrega una fuente **Browser** a tu escena.
2. URL (desarrollo): `http://localhost:5173/`
   URL (producción, cuando el backend sirva el build): `http://localhost:8710/widget/`
   (la URL es la misma con Docker o sin Docker)
3. Tamaño recomendado: **800 × 900** (la ruleta escala sola a cualquier tamaño).
4. El fondo es transparente: la ruleta se compone sobre tu stream.

## Si la app exige un hostname DNS (TikTok Live Studio)

Algunas apps rechazan `localhost` o IPs y exigen un nombre de dominio.
`sslip.io` es un DNS público que convierte cualquier IP en hostname —
sin túneles, sin exponer nada a internet:

| Escenario | URL |
| --- | --- |
| Live Studio en la MISMA máquina que Docker | `http://127-0-0-1.sslip.io:8710/widget/` |
| Live Studio en OTRA PC de tu red (ej. la máquina es 192.168.1.34) | `http://192-168-1-34.sslip.io:8710/widget/` |

Para el segundo caso, en `docker-compose.yml` cambia el mapeo de puertos
de `'127.0.0.1:8710:8710'` a `'8710:8710'` (queda accesible para toda tu
red local) y usa la IP real de la máquina (`ipconfig getifaddr en0`).

Requiere internet para resolver el DNS (el tráfico igual nunca sale de tu
red). Si la app además exige **https**, se necesita un túnel (Cloudflare
Tunnel) — en ese caso hay que proteger el panel primero.

## Módulos y `?show=` (ruleta, cofre, oferta)

El widget incluye tres módulos: la **ruleta**, el **Cofre del Live** y la
**Oferta Relámpago**. El parámetro `?show=` elige cuáles renderiza cada
fuente:

| URL                                            | Muestra                            |
| ---------------------------------------------- | ---------------------------------- |
| `http://localhost:8710/widget/`                | Los tres (layout combinado)        |
| `http://localhost:8710/widget/?show=wheel`     | Solo la ruleta                     |
| `http://localhost:8710/widget/?show=chest`     | Solo el cofre (grande y centrado)  |
| `http://localhost:8710/widget/?show=offer`     | Solo la oferta (grande y centrada) |
| `http://localhost:8710/widget/?show=prizes`    | Tablero público de premios y reglas |
| `?show=wheel,chest` / `?show=chest,offer` etc. | Cualquier combinación              |

**Recomendado**: una fuente por módulo (`?show=wheel`, `?show=chest`,
`?show=offer`) para moverlos y ocultarlos por separado en OBS con el ojito.
Tamaños sugeridos: cofre **500 × 620**, oferta **900 × 560**, tablero de
premios **1000 × 900**. La oferta no dibuja nada hasta que la actives desde
el panel — la fuente puede quedarse visible siempre. El tablero muestra a
la audiencia cada premio con su probabilidad y sus reglas en lenguaje de
cliente (compra mínima, máximos por live, "solo durante ofertas"), se
actualiza solo al editar premios, y atenúa los agotados.

## Ajustes críticos (no opcionales)

| Ajuste                                                                             | Valor       | Por qué                                                                                             |
| ---------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| **Custom frame rate → FPS**                                                        | `60`        | OBS renderiza Browser Sources a 30 FPS por defecto; la animación está diseñada para 60.             |
| Ajustes de OBS → Avanzado → **Aceleración por hardware para fuentes de navegador** | Activada    | Sin GPU, PixiJS cae a canvas por software y los 60 FPS no son alcanzables.                          |
| **Control audio via OBS** (en la fuente)                                           | Activada    | Permite mezclar los sonidos de la ruleta (ticks, fanfarria) en el audio del stream.                 |
| **Shutdown source when not visible**                                               | Desactivada | Mantiene el WebSocket conectado aunque ocultes la escena.                                           |
| **Refresh browser when scene becomes active**                                      | Desactivada | Evita recargas innecesarias (aunque una recarga a mitad de giro se recupera sola vía `state.sync`). |

## Probar sin OBS

Abre `http://localhost:5173/?bg=dark` en Chrome: es exactamente el mismo widget
con un fondo oscuro de previsualización. El parámetro `bg` acepta cualquier
color CSS (`?bg=%23222222`) y solo afecta la página, nunca al overlay en OBS.

Nota de audio: los navegadores normales exigen un clic en la página antes de
permitir sonido (haz clic una vez sobre el widget); OBS reproduce audio sin
gesto de usuario.

## Temas

Los temas viven en `packages/widget/public/themes/<id>/theme.json` y pueden
sobreescribir cualquier subconjunto del tema base `casino` (colores, iconos,
sonidos). Cambia el tema activo desde el panel; el widget lo aplica al quedar
en reposo (nunca a mitad de un giro). Un `theme.json` inválido o ausente cae
automáticamente al tema casino — un tema roto jamás deja la pantalla en negro.
