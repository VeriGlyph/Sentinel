export COMPOSE_PROJECT_NAME=veriglyph-sentinel
export COMPOSE_FILE=docker-compose.yml

.PHONY: up
up:
	$(MAKE) down
	docker-compose build
	docker-compose up -d

.PHONY: down
down:
	docker-compose down --remove-orphans

.PHONY: status
status:
	docker-compose ps

.PHONY: stats
stats:
	docker stats veriglyph-sentinel-backend veriglyph-sentinel-indexer

.PHONY: logs
logs:
	docker-compose logs -f --tail=100

.PHONY: shell-backend
shell-backend:
	docker exec -it veriglyph-sentinel-backend sh

.PHONY: shell-indexer
shell-indexer:
	docker exec -it veriglyph-sentinel-indexer sh
