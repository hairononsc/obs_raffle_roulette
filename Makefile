# WheelLive — atajos de operación. `make help` lista todo.

.DEFAULT_GOAL := help

.PHONY: help up down restart logs build backup dev test status

help: ## Lista los comandos disponibles
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'

up: ## Levanta la app + PostgreSQL (modo live)
	docker compose up -d
	@echo "Panel:  http://localhost:8710/panel/"
	@echo "Widget: http://localhost:8710/widget/"

down: ## Apaga los contenedores (los datos persisten en el volumen)
	docker compose down

restart: ## Reinicia solo la app (recuperación rápida en vivo)
	docker compose restart app

logs: ## Sigue los logs de la app
	docker compose logs -f app

build: ## Reconstruye la imagen tras cambiar código (luego: make up)
	docker compose build

backup: ## Dump de PostgreSQL a backups/*.sql
	@mkdir -p backups
	docker compose exec db pg_dump -U wheellive wheellive > backups/wheellive-$$(date +%Y%m%dT%H%M%S).sql
	@ls -t backups/*.sql | head -1

status: ## Estado de los contenedores
	docker compose ps

dev: ## Modo desarrollo sin Docker (SQLite local)
	pnpm live
	

test: ## Corre toda la suite de tests
	pnpm test
