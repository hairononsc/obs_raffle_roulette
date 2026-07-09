# WheelLive — Protocolo WebSocket v1

Contrato de mensajes entre el backend (Node), el panel web y el widget (OBS).
La fuente de verdad ejecutable son los schemas Zod en `packages/shared/src/protocol/`;
los tres módulos la importan directamente desde `@wheellive/shared`, así que el
compilador garantiza la coherencia — este documento es la referencia humana. Los ejemplos canónicos
viven en `packages/shared/fixtures/` y se validan en CI — si editas el protocolo,
actualiza schemas, fixtures y este documento en el mismo commit.

## Envelope

Cada frame WebSocket es un único objeto JSON:

```json
{
  "v": 1,
  "type": "queue.add",
  "ts": 1730000001000,
  "requestId": "req-001",
  "payload": {}
}
```

| Campo       | Tipo   | Notas                                                                                           |
| ----------- | ------ | ----------------------------------------------------------------------------------------------- |
| `v`         | number | Versión del protocolo. Se rechaza cualquier frame con `v` distinto.                             |
| `type`      | string | Discriminador del mensaje.                                                                      |
| `ts`        | number | Epoch ms del emisor. Solo diagnóstico; nunca lógica.                                            |
| `requestId` | string | Opcional. Correlaciona un comando con su `ack`/`error`. El panel debe enviarlo en todo comando. |
| `payload`   | object | Contenido tipado según `type`.                                                                  |

## Conexión y roles

1. El cliente abre el WebSocket y envía `hello` como primer mensaje.
2. Respuesta exitosa: `state.sync`. Fallo: `error` (`INVALID_MESSAGE`) y cierre.
3. Cualquier mensaje previo al `hello`, o un tipo no permitido para el rol, produce `error` (`FORBIDDEN`).

Permisos por rol:

- **panel**: todos los mensajes cliente excepto `wheel.spin.landed`.
- **widget**: solo `hello` y `wheel.spin.landed`.

## Mensajes cliente → servidor

| `type`              | Emisor | Payload                                | Efecto                                                      |
| ------------------- | ------ | -------------------------------------- | ----------------------------------------------------------- |
| `hello`             | ambos  | `role`, `clientInfo?`                  | Registra el rol y suscribe. Respuesta: `state.sync`.        |
| `queue.add`         | panel  | `buyerName`, `spins` (1–50), `note?`, `phone?`, `purchaseAmount?`, `itemsCount?`, `profileId?`, `enabledPrizeIds?`, `disabledPrizeIds?`, `approvals?` | Crea entrada; el servidor evalúa la elegibilidad y persiste `eligiblePrizeIds`. Broadcast: `queue.changed`. |
| `queue.remove`      | panel  | `entryId`                              | Elimina entrada. Broadcast: `queue.changed`.                |
| `spin.launch`       | panel  | `entryId`                              | Lanza **un** giro de esa entrada. Ver ciclo de vida abajo.  |
| `wheel.spin.landed` | widget | `spinId`                               | Confirma que la animación aterrizó en el segmento objetivo. |
| `prize.create`      | panel  | `prize` (sin `id`)                     | Broadcast: `prizes.changed`.                                |
| `prize.update`      | panel  | `prizeId`, `patch` (parcial, no vacío) | Broadcast: `prizes.changed`.                                |
| `prize.delete`      | panel  | `prizeId`                              | Broadcast: `prizes.changed`.                                |
| `settings.update`   | panel  | `settings` (objeto completo, no patch) | Broadcast: `settings.changed`.                              |
| `theme.set`         | panel  | `themeId`                              | Broadcast: `theme.changed`.                                 |
| `chest.key.add`     | panel  | `{}`                                   | +1 llave (clamp al total; al llegar, desbloquea). Broadcast: `chest.changed`. |
| `chest.key.remove`  | panel  | `{}`                                   | −1 llave (clamp en 0). Broadcast: `chest.changed`.          |
| `chest.open`        | panel  | `{}`                                   | Abre manualmente (idempotente). Broadcast: `chest.changed`. |
| `chest.close`       | panel  | `{}`                                   | Cierra conservando llaves. Broadcast: `chest.changed`.      |
| `chest.reset`       | panel  | `{}`                                   | Llaves a 0 y cerrado. Broadcast: `chest.changed`.           |
| `chest.configure`   | panel  | `prize`, `keysTarget` (1–50)           | Configura premio/meta; nunca auto-abre. Broadcast: `chest.changed`. |
| `offer.start`       | panel  | `title`, `description`, `durationMs`   | Activa oferta (rechaza si hay una activa). Broadcast: `offer.changed`. |
| `offer.cancel`      | panel  | `{}`                                   | Cancela la oferta activa (no-op si no hay). Broadcast: `offer.changed`. |
| `profile.save`      | panel  | `profile` (`id?` = crear/editar)       | Guarda un perfil de ruleta. Broadcast: `profiles.changed`.  |
| `profile.delete`    | panel  | `profileId`                            | Elimina un perfil. Broadcast: `profiles.changed`.           |

Con el cofre desbloqueado, `chest.key.add`/`chest.key.remove` responden
`error INVALID_STATE`.

Todo comando del panel recibe exactamente una respuesta directa: `ack` (con su
`requestId`) o `error`. Los broadcasts llegan además a todos los clientes conectados,
incluido el emisor.

## Mensajes servidor → cliente

| `type`             | Alcance   | Payload                                                                                           |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------- |
| `state.sync`       | directo   | Snapshot completo: `settings`, `themeId`, `prizes`, `segments`, `queue`, `activeSpin` (o `null`), `chest`, `flashOffer` (o `null`). |
| `ack`              | directo   | `{}` — éxito del comando referido por `requestId`.                                                |
| `error`            | directo   | `code`, `message`. Con `requestId` si respondía a un comando.                                     |
| `queue.changed`    | broadcast | Cola completa actualizada.                                                                        |
| `wheel.spin.start` | broadcast | `spin` (ActiveSpin): resultado ya decidido + parámetros de animación.                             |
| `spin.completed`   | broadcast | `spinId`, `buyerName`, `prizeId`, `prizeName`, `completedAt`.                                     |
| `prizes.changed`   | broadcast | Lista de premios + layout de segmentos derivado.                                                  |
| `settings.changed` | broadcast | Settings vigentes.                                                                                |
| `theme.changed`    | broadcast | `themeId` activo.                                                                                 |
| `chest.changed`    | broadcast | `chest` (estado completo) + `cause` (`keyAdded`/`keyRemoved`/`opened`/`closed`/`reset`/`configured`) — la causa decide la animación del widget. |
| `offer.changed`    | broadcast | `offer` (completo al iniciar, `null` al terminar) + `cause` (`started`/`cancelled`/`expired`). El countdown lo calcula cada cliente desde `endsAt`. |

**Regla de reconstrucción**: cualquier cliente debe poder reconstruir toda su UI
solo con `state.sync`. Esto hace recuperable una recarga del Browser Source de OBS
en mitad de un giro.

## Ciclo de vida del giro

```
spin.launch (panel)
  → servidor: valida (no hay giro activo, entrada existe y tiene giros,
              hay premios elegibles)
  → servidor: decide premio, RESERVA stock y persiste — transacción única
  → broadcast wheel.spin.start          [status: spinning]
  → widget anima hasta targetSegmentIndex
  → wheel.spin.landed (widget)          [status: landed → celebrating]
  → broadcast spin.completed            [terminal]
  → broadcast queue.changed (+ prizes.changed si el stock cambió a ojos del cliente)
```

Garantías:

- **Un solo giro activo.** `spin.launch` con giro en curso → `error SPIN_IN_PROGRESS`.
- **El resultado se persiste al decidirse**, no al terminar la animación. El premio
  del comprador nunca depende de que el widget esté vivo.
- **Timeout de seguridad.** Si el widget no confirma `wheel.spin.landed` dentro del
  margen (duración de animación + margen fijo), el servidor completa el giro
  igualmente y emite `spin.completed`. La cola nunca se congela.
- **Segmentos, no premios.** El widget aterriza en `targetSegmentIndex` contra el
  layout `segments` vigente (recibido en `state.sync` / `prizes.changed`). El widget
  jamás calcula el layout por su cuenta.

## Errores

`INVALID_MESSAGE` · `FORBIDDEN` · `ENTRY_NOT_FOUND` · `NO_ELIGIBLE_PRIZES` · `PROFILE_NOT_FOUND` ·
`PRIZE_NOT_FOUND` · `SPIN_IN_PROGRESS` · `SPIN_NOT_ACTIVE` · `NO_STOCK_AVAILABLE` ·
`NO_SPINS_REMAINING` · `INVALID_STATE` · `INTERNAL_ERROR`

Semántica exacta en `packages/shared/src/protocol/errors.ts`.

## Fuera del WebSocket

Consultas históricas y estadísticas (paginadas, pesadas, sin tiempo real) van por
REST: `GET /api/history`, `GET /api/stats` (se especifican en el módulo backend).
El canal WS transporta solo estado vivo y comandos.

## Versionado

- Cambios aditivos y compatibles (campo opcional nuevo, mensaje nuevo): no suben `v`.
- Cambios incompatibles (renombrar/eliminar campos, cambiar semántica): suben `v`
  y se documentan aquí con una tabla de migración.
