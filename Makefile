# ngano
#
# Every target delegates to the package that owns the work. Targets are safe to
# run when a package is missing: the recipe skips it and says so, so a fresh
# clone of a partially built tree still works.
#
#   make install    set up all four packages
#   make test       run every test suite
#   make lint       run every linter and formatter check
#   make build      build distributable artefacts
#   make dev        run the Worker locally (API, MCP and site)
#   make deploy     deploy the Worker to Cloudflare
#   make sync-data  refresh the data snapshots bundled into each package
#   make validate   validate the catalogue and the generated README section

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

PYTHON ?= python3
NPM    ?= npm
CARGO  ?= cargo

PY_DIR     := packages/python
JS_DIR     := packages/js
RS_DIR     := packages/rust
WORKER_DIR := worker

# Run $(2) inside directory $(1) if it exists, otherwise report the skip.
define in_dir
	@if [ -d "$(1)" ]; then \
		echo "==> $(1)"; \
		( cd "$(1)" && $(2) ); \
	else \
		echo "==> $(1) not present, skipping"; \
	fi
endef

.PHONY: help
help: ## Show this help
	@echo "ngano make targets:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------- install ---

.PHONY: install install-python install-js install-rust install-worker install-docs

install: install-python install-js install-rust install-worker ## Set up every package
	@echo "==> all packages installed"

install-python: ## Editable install of the Python package with dev and hf extras
	$(call in_dir,$(PY_DIR),$(PYTHON) -m pip install -e ".[dev,hf]")

install-js: ## Install JavaScript package dependencies
	$(call in_dir,$(JS_DIR),$(NPM) ci)

install-rust: ## Fetch Rust dependencies
	$(call in_dir,$(RS_DIR),$(CARGO) fetch)

install-worker: ## Install Worker dependencies
	$(call in_dir,$(WORKER_DIR),$(NPM) ci)

install-docs: ## Install the documentation toolchain
	$(PYTHON) -m pip install mkdocs mkdocs-material

# ------------------------------------------------------------------- test ---

.PHONY: test test-python test-js test-rust test-worker

test: validate test-python test-js test-rust test-worker ## Run every test suite
	@echo "==> all tests passed"

test-python: ## pytest and mypy
	$(call in_dir,$(PY_DIR),$(PYTHON) -m pytest -q && $(PYTHON) -m mypy src/ngano)

test-js: ## vitest and tsc
	$(call in_dir,$(JS_DIR),$(NPM) test && $(NPM) run typecheck)

test-rust: ## cargo test
	$(call in_dir,$(RS_DIR),$(CARGO) test --all-features)

test-worker: ## Worker vitest and tsc
	$(call in_dir,$(WORKER_DIR),$(NPM) test && $(NPM) run typecheck)

# ------------------------------------------------------------------- lint ---

.PHONY: lint lint-python lint-js lint-rust lint-worker

lint: lint-python lint-js lint-rust lint-worker ## Run every linter
	@echo "==> lint clean"

lint-python: ## ruff and mypy
	$(call in_dir,$(PY_DIR),$(PYTHON) -m ruff check . && $(PYTHON) -m ruff format --check . && $(PYTHON) -m mypy src/ngano)

lint-js: ## tsc, which is the JavaScript package's lint gate
	$(call in_dir,$(JS_DIR),$(NPM) run typecheck)

lint-rust: ## clippy and rustfmt
	$(call in_dir,$(RS_DIR),$(CARGO) fmt --all -- --check && $(CARGO) clippy --all-targets --all-features -- -D warnings)

lint-worker: ## Worker typecheck
	$(call in_dir,$(WORKER_DIR),$(NPM) run typecheck)

# ------------------------------------------------------------------ build ---

.PHONY: build build-python build-js build-rust build-docs

build: build-python build-js build-rust build-docs ## Build every distributable
	@echo "==> build complete"

build-python: ## sdist and wheel
	$(call in_dir,$(PY_DIR),$(PYTHON) -m build)

build-js: ## Compile TypeScript to dist/
	$(call in_dir,$(JS_DIR),$(NPM) run build)

build-rust: ## Release build and packaging check
	$(call in_dir,$(RS_DIR),$(CARGO) build --release && $(CARGO) package --allow-dirty)

build-docs: ## Build the MkDocs site into site/
	mkdocs build --strict

# -------------------------------------------------------------------- dev ---

.PHONY: dev dev-docs

dev: ## Run the Worker locally: API, MCP and site
	$(call in_dir,$(WORKER_DIR),$(NPM) run dev)

dev-docs: ## Serve the documentation with live reload
	mkdocs serve

# ----------------------------------------------------------------- deploy ---

.PHONY: deploy

deploy: validate test-worker ## Deploy the Worker to Cloudflare
	@if [ -z "$${CLOUDFLARE_API_TOKEN:-}" ]; then \
		echo "CLOUDFLARE_API_TOKEN is not set. CI deploys from .github/workflows/deploy.yml."; \
		exit 1; \
	fi
	$(call in_dir,$(WORKER_DIR),$(NPM) run deploy)

# -------------------------------------------------------------- sync-data ---

.PHONY: sync-data

sync-data: validate ## Refresh the data snapshot bundled into each package
	$(call in_dir,$(PY_DIR),$(PYTHON) sync_data.py)
	$(call in_dir,$(JS_DIR),$(NPM) run sync-data)
	@if [ -d "$(RS_DIR)" ]; then \
		echo "==> $(RS_DIR)"; \
		cp data/catalogue.json data/countries.json data/languages.json \
		   data/field_map.json "$(RS_DIR)/data/"; \
	else \
		echo "==> $(RS_DIR) not present, skipping"; \
	fi
	@echo "==> data synced. Commit the snapshots alongside the catalogue change."

.PHONY: sync-data-check
sync-data-check: ## Fail if any bundled snapshot has drifted from data/
	$(call in_dir,$(PY_DIR),$(PYTHON) sync_data.py --check)
	@for f in catalogue.json countries.json languages.json field_map.json; do \
		if [ -f "$(RS_DIR)/data/$$f" ] && ! cmp -s "data/$$f" "$(RS_DIR)/data/$$f"; then \
			echo "$(RS_DIR)/data/$$f has drifted from data/$$f, run make sync-data"; \
			exit 1; \
		fi; \
	done
	@echo "==> bundled data snapshots are current"

# --------------------------------------------------------------- validate ---

.PHONY: validate credits

validate: ## Validate the catalogue and check the generated README section
	@echo "==> validating the catalogue"
	@$(PYTHON) scripts/validate_catalogue.py
	@echo "==> checking the README credits section"
	@$(PYTHON) scripts/render_readme_credits.py --check

credits: ## Regenerate the README credits section from data/credits.json
	@$(PYTHON) scripts/render_readme_credits.py

.PHONY: stats
stats: ## Print the headline catalogue numbers
	@$(PYTHON) scripts/stats.py

.PHONY: clean
clean: ## Remove build artefacts
	rm -rf site/ $(PY_DIR)/dist $(PY_DIR)/build $(JS_DIR)/dist $(WORKER_DIR)/dist
	find . -name '__pycache__' -type d -prune -exec rm -rf {} +
	find . -name '*.egg-info' -type d -prune -exec rm -rf {} +
	@echo "==> cleaned"
