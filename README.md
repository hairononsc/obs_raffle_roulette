# WheelLive

Sistema profesional de ruleta de premios para transmisiones en TikTok Live.
El backend decide todos los resultados; el widget (OBS Browser Source) solo anima;
el panel web opera el show en tiempo real desde cualquier navegador.

## Estructura

```
packages/
  shared/    Contrato: schemas Zod del protocolo WS + tipos de dominio + fixtures
  backend/   Node + Fastify + ws + SQLite — lógica de negocio autoritativa
  widget/    Vite + PixiJS + WebAudio — Browser Source para OBS
             (temas en packages/widget/public/themes/)
  panel/     Vite + TypeScript + HTML/CSS — panel administrativo web
docs/
  PROTOCOL.md      Contrato de mensajes WebSocket
  OBS_SETUP.md     Configuración de OBS (60 FPS, audio, transparencia)
```

## Desarrollo

```bash
pnpm --filter @wheellive/backend dev   # servidor en http://127.0.0.1:8710
pnpm --filter @wheellive/widget dev    # widget en http://localhost:5173
pnpm --filter @wheellive/panel dev     # panel en http://localhost:5174
```

Abre `http://localhost:5173/?bg=dark` para ver la ruleta sin OBS y
`http://localhost:5174` para operar (token de desarrollo: `dev-token`).

## Producción (un solo proceso)

```bash
WHEELLIVE_PANEL_TOKEN=mi-secreto pnpm live
```

Compila todo y sirve panel (`/panel/`), widget para OBS (`/widget/`) y API
desde `http://localhost:8710`. Al arrancar hace backup automático de la base
de datos en `data/backups/`. Checklist completo en `docs/LIVE_CHECKLIST.md`.

## Requisitos

- Node >= 20, pnpm >= 9

## Comandos

```bash
pnpm install        # dependencias de todo el workspace
pnpm build          # compila todos los paquetes
pnpm typecheck      # tsc --noEmit en todos los paquetes
pnpm test           # tests de todos los paquetes
pnpm lint           # ESLint
pnpm format         # Prettier
```
# obs_raffle_roulette
