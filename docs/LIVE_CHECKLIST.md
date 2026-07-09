# WheelLive — Checklist antes de cada live

## Arranque (modo producción: Docker + PostgreSQL)

0. Abre **Docker Desktop** y espera a que diga "running".

```bash
pnpm docker:up
```

Levanta PostgreSQL + la app en `http://127.0.0.1:8710`, que sirve:

| URL                                 | Qué es                           |
| ----------------------------------- | -------------------------------- |
| `http://localhost:8710/panel/`      | Panel del operador               |
| `http://localhost:8710/widget/`     | Widget para OBS (Browser Source) |
| `http://localhost:8710/api/history` | Historial (REST)                 |

Comandos útiles: `pnpm docker:logs` (ver logs), `pnpm docker:down` (apagar),
`pnpm docker:build` (reconstruir tras cambiar código).

**Backup manual** (recomendado antes de cada live):

```bash
pnpm docker:backup      # deja un .sql en backups/
```

### Modo alternativo sin Docker (emergencia)

```bash
pnpm live
```

Compila y arranca con SQLite local (`data/wheellive.sqlite`), con backup
automático al arrancar en `data/backups/`. ⚠️ **Los datos de PostgreSQL y
SQLite NO se comparten**: premios, cola e historial son independientes en
cada modo.

## Checklist

**OBS** (detalle completo en `OBS_SETUP.md`)

- [ ] Browser Source apuntando a `http://localhost:8710/widget/`
      (o fuentes separadas con `?show=` — ver OBS_SETUP.md)
- [ ] FPS personalizado del source: **60**
- [ ] Aceleración por hardware de fuentes de navegador: **activada**
- [ ] "Control audio via OBS" activado y el audio de la ruleta audible en la mezcla
- [ ] "Shutdown source when not visible": **desactivado**

**Contenido**

- [ ] Premios cargados con inventario real (panel → Premios)
- [ ] Probabilidades revisadas (columna "Prob." del panel)
- [ ] Tema correcto seleccionado (panel → Ajustes)
- [ ] Giro de prueba completo: registrar comprador de prueba → Girar →
      ver animación + sonido en OBS → verificar que aparece en Historial →
      eliminar el registro de prueba de la vista si hace falta

**Cofre del Live** (panel → Cofre del Live)

- [ ] Premio del cofre configurado (texto + emoji, ej. `👖 Jean Gratis`)
- [ ] Total de llaves configurado y cofre en `🔒 0/N` (botón Reiniciar)
- [ ] Prueba completa: agregar llaves hasta el total → ver la apertura con
      confeti en OBS → Reiniciar

**Oferta Relámpago** (panel → pestaña Oferta)

- [ ] Prueba: activar una oferta de 1 minuto → ver la tarjeta con countdown
      en OBS → Cancelar

**Programa de Ofertas** (panel → pestaña Oferta)

- [ ] Pool con 2+ ofertas guardadas (título, descripción, duración)
- [ ] Al empezar el live: Iniciar programa con la duración real del live y
      la cantidad de ofertas — el panel muestra "próxima ≈ HH:MM"
- Reglas: primera oferta ≥10 min tras iniciar, separación ≥20 min, la
  última termina antes del fin del live. Si lanzas una oferta manual y el
  programa dispara en ese momento, ese disparo se salta (no se enciman).
- [ ] Al terminar el live: si sobró programa, Detener

**Recuperación (por si algo falla en vivo)**

- El premio queda registrado en el instante en que presionas Girar — aunque
  OBS se caiga a mitad de animación, el premio del cliente está en el historial.
- Si el widget se recarga, se reengancha solo (giro activo, estado del cofre
  y oferta con su countdown incluidos).
- Si el proceso muere: `docker compose restart app` (o `pnpm start` en modo
  SQLite); los giros interrumpidos se cierran como completados, la cola queda
  intacta, y una oferta vigente se re-arma con el tiempo restante.
