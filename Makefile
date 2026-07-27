# ERP System — one-command developer experience.
# Run `make` or `make help` to list targets.

.DEFAULT_GOAL := help
.PHONY: help setup setup-interactive up down restart logs migrate seed reset demo preview ps psql

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: ## First-time setup: env + start + migrate + seed (ONE command)
	@./scripts/setup.sh

setup-interactive: ## First-time setup with prompts for DB/tokens/ports instead of placeholders
	@./scripts/setup.sh --interactive

up: ## Start all services (web + api + db) in the background
	docker compose up -d

down: ## Stop all services (keeps the database volume)
	docker compose down

restart: ## Restart all services
	docker compose restart

logs: ## Tail logs from all services
	docker compose logs -f

migrate: ## Apply Drizzle migrations to PostgreSQL
	docker compose exec api npm run migrate

seed: ## Seed sample data (SG + MY demo companies)
	docker compose exec -e ERP_ENV=demo -e ERP_DEMO_SEED=I_UNDERSTAND_DEMO_DATA api npm run seed

reset: ## DESTRUCTIVE: wipe DB volume and re-setup from scratch
	docker compose down -v
	@./scripts/setup.sh

demo: ## Build the static demo bundle (PGlite) into dist/
	npm run build:demo

preview: ## Serve the built demo locally
	npm run preview

ps: ## Show service status
	docker compose ps

psql: ## Open a psql shell on the database
	docker compose exec db psql -U $${DB_USER:-erp} -d erp
