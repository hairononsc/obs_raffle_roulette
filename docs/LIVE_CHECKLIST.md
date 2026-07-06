# WheelLive — Checklist antes de cada live

## Arranque (modo producción: un solo proceso)

```bash
pnpm live
```

Esto compila todo y arranca el backend en `http://127.0.0.1:8710`, que sirve:

| URL                                 | Qué es                           |
| ----------------------------------- | -------------------------------- |
| `http://localhost:8710/panel/`      | Panel del operador               |
| `http://localhost:8710/widget/`     | Widget para OBS (Browser Source) |
| `http://localhost:8710/api/history` | Historial (REST)                 |

Al arrancar se crea automáticamente un backup de la base de datos en
`data/backups/` (se conservan los 10 más recientes).

## Checklist

**Seguridad**

- [ ] Token real configurado: `WHEELLIVE_PANEL_TOKEN=<secreto> pnpm live`.
      Si ves el warning "using the default panel token" en la consola, NO salgas en vivo así.

**OBS** (detalle completo en `OBS_SETUP.md`)

- [ ] Browser Source apuntando a `http://localhost:8710/widget/`
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

**Recuperación (por si algo falla en vivo)**

- El premio queda registrado en el instante en que presionas Girar — aunque
  OBS se caiga a mitad de animación, el premio del cliente está en el historial.
- Si el widget se recarga, se reengancha solo (vuelve a mostrar el giro activo).
- Si el proceso muere: `pnpm start` lo levanta de nuevo; los giros interrumpidos
  se cierran como completados y la cola queda intacta.
