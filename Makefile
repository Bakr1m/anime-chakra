.PHONY: check test lint e2e py-test parity train extract docker-build docker-run phone phone-lan dev build web-install py-install

dev:
	cd web && npm run dev

build:
	cd web && npm run build

web-install:
	cd web && npm ci

py-install:
	python3 -m pip install -e "./python[dev]"

lint:
	cd web && npm run lint
	cd web && npm run typecheck
	cd python && (ruff check src tests || python3 -m ruff check src tests)
	cd python && (mypy src || python3 -m mypy src)

check: lint test py-test

test:
	cd web && npm run test

py-test:
	cd python && (pytest -q || python3 -m pytest -q)

parity:
	python3 scripts/parity.py

e2e:
	cd web && npx playwright test

train:
	chakralens train --data data --out models-export/classifier.json

extract:
	chakralens extract videos/ --out data/

docker-build:
	docker build -f docker/web.Dockerfile -t anime-chakra:local .
	docker build -f docker/lab.Dockerfile -t anime-chakra-lab:local .

docker-run:
	docker run --rm -p 8080:8080 anime-chakra:local

phone:
	docker compose -f docker/compose.yml --profile tunnel up

phone-lan:
	docker compose -f docker/compose.yml --profile https up
