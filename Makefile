.PHONY: help install install-local update outdated audit rebuild-dev rebuild-prod rebuild-test lint format typecheck security install-hooks check-all

help:
	@echo "Available commands:"
	@echo "  make install       - Install dependencies"
	@echo "  make install-local - Install dependencies with local extras"
	@echo "  make update        - Update all dependencies"
	@echo "  make outdated      - Check for outdated packages"
	@echo "  make audit         - Check for security vulnerabilities"
	@echo "  make lint          - Run Python linting (ruff)"
	@echo "  make format        - Format Python code (ruff)"
	@echo "  make typecheck     - Run Python type checking (mypy)"
	@echo "  make security      - Run Python security scan (bandit)"
	@echo "  make install-hooks - Install pre-commit hooks"
	@echo "  make check-all     - Run all quality checks"
	@echo "  make rebuild-dev   - Rebuild dev Docker image"
	@echo "  make rebuild-prod  - Rebuild prod Docker image"
	@echo "  make rebuild-test  - Rebuild test Docker image"

install:
	cd server && UV_LINK_MODE=copy uv pip install -r pyproject.toml

install-local:
	cd server && UV_LINK_MODE=copy uv pip install -r pyproject.toml --extra local

update:
	cd server && uv lock --upgrade
	cd server && UV_LINK_MODE=copy uv pip install -r pyproject.toml
	npm update

outdated:
	cd server && uv pip list --outdated

audit:
	cd server && uv pip check

rebuild-dev:
	docker build -f Dockerfile.dev -t localhost/phlox-dev:latest .

rebuild-prod:
	docker build -f Dockerfile -t localhost/phlox:latest .

rebuild-test:
	docker build -f Dockerfile.test -t localhost/phlox-test:latest .

lint:
	cd server && ruff check .

format:
	cd server && ruff format .
	cd server && ruff check . --fix

typecheck:
	cd server && mypy .

security:
	cd server && bandit -c pyproject.toml -r .

install-hooks:
	pre-commit install

check-all: lint typecheck security
	@echo "All code quality checks passed!"
