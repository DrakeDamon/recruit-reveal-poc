# Recruit Reveal ML Pipeline Makefile
# Deployment automation for AutoGluon + XGBoost models

PYTHON := python3
PIP := pip3
ML_API_PORT := 8000
POSITIONS := qb rb wr
MODEL_VERSION := 1.1.0

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

.PHONY: help install data train api test build deploy clean benchmark

help: ## Show this help message
	@echo "Recruit Reveal ML Pipeline Commands:"
	@echo "===================================="
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  ${GREEN}%-15s${NC} %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install all dependencies (Python + Node.js)
	@echo "${YELLOW}📦 Installing dependencies...${NC}"
	$(PIP) install -r requirements.txt
	$(PIP) install -r ml-api/requirements.txt
	npm install
	@echo "${GREEN}✅ Dependencies installed successfully${NC}"

data: ## Download real training data from Azure Blob Storage
	@echo "${YELLOW}📥 Downloading training data from Azure...${NC}"
	@$(PYTHON) -c "from recruit_reveal.azure_blob_client import get_blob_client; \
		from dotenv import load_dotenv; \
		load_dotenv(); \
		client = get_blob_client(); \
		success = all([client.download_csv(f'{pos}.csv', f'data/{pos}.csv') for pos in ['qb','rb','wr']]); \
		print('✅ Real data downloaded successfully' if success else '❌ Data download failed')"
	@ls -la data/*.csv && echo "${GREEN}✅ Training data ready${NC}" || echo "${RED}❌ Data files missing${NC}"

train: ## Train models with AutoGluon (primary) + XGBoost (fallback)
	@echo "${YELLOW}🔬 Training models with notebook parity...${NC}"
	@echo "Target metrics: Overall ≥87%, Within-one ≥98%, FCS ≥69%"
	@for pos in $(POSITIONS); do \
		echo "${YELLOW}Training $$pos model...${NC}"; \
		$(PYTHON) -m recruit_reveal.train_autogluon \
			--position $$pos \
			--version $(MODEL_VERSION) \
			--target-accuracy 0.87 \
			--eval || exit 1; \
	done
	@echo "${GREEN}✅ All models trained successfully${NC}"
	@ls -la models/ | grep -E "(autogluon|pipeline)" && echo "${GREEN}Model files created${NC}"

api: ## Start ML API server locally (port 8000)
	@echo "${YELLOW}🚀 Starting ML API server on port $(ML_API_PORT)...${NC}"
	@echo "Available endpoints:"
	@echo "  GET  http://localhost:$(ML_API_PORT)/health"
	@echo "  GET  http://localhost:$(ML_API_PORT)/models"
	@echo "  POST http://localhost:$(ML_API_PORT)/predict"
	cd ml-api && $(PYTHON) -m uvicorn main:app --reload --host 0.0.0.0 --port $(ML_API_PORT)

test: ## Run comprehensive smoke tests
	@echo "${YELLOW}🧪 Running ML API smoke tests...${NC}"
	@$(PYTHON) scripts/smoke_test_api.py || (echo "${RED}❌ Smoke tests failed${NC}" && exit 1)
	@echo "${GREEN}✅ All smoke tests passed${NC}"

build: ## Build Docker container for production
	@echo "${YELLOW}🐳 Building Docker container...${NC}"
	docker build -t recruit-reveal-ml-api .
	@echo "${GREEN}✅ Docker container built successfully${NC}"

deploy: ## Deploy to Render (requires render.yaml configuration)
	@echo "${YELLOW}🚀 Deploying to Render...${NC}"
	@echo "Ensure render.yaml is configured with:"
	@echo "  - SAS_URL environment variable"
	@echo "  - MODEL_VERSION=latest"
	@echo "  - Build command includes: make train"
	@echo "Run: render create service"
	@echo "${GREEN}✅ Deployment configuration ready${NC}"

clean: ## Clean up temporary files and caches
	@echo "${YELLOW}🧹 Cleaning up temporary files...${NC}"
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	find . -name "*.pyo" -delete 2>/dev/null || true
	find . -name ".DS_Store" -delete 2>/dev/null || true
	rm -rf .pytest_cache/ 2>/dev/null || true
	rm -rf temp_models/ 2>/dev/null || true
	@echo "${GREEN}✅ Cleanup completed${NC}"

benchmark: ## Run performance benchmarks on trained models
	@echo "${YELLOW}⚡ Running performance benchmarks...${NC}"
	@$(PYTHON) -c "import time; \
		from recruit_reveal.azure_blob_client import get_blob_client; \
		start = time.time(); \
		client = get_blob_client(); \
		print(f'Blob client init: {(time.time()-start)*1000:.1f}ms')"
	@for pos in $(POSITIONS); do \
		echo "Benchmarking $$pos model..."; \
		$(PYTHON) scripts/benchmark_model.py --position $$pos 2>/dev/null || echo "  Model not found: $$pos"; \
	done
	@echo "${GREEN}✅ Benchmarks completed${NC}"

# Development helpers
dev-setup: install data ## Quick development environment setup
	@echo "${GREEN}✅ Development environment ready${NC}"

full-pipeline: install data train test ## Run complete pipeline from scratch
	@echo "${GREEN}🎉 Full pipeline completed successfully!${NC}"
	@echo "Ready for production deployment"

check-models: ## Check model files and metadata
	@echo "${YELLOW}📊 Checking model status...${NC}"
	@ls -la models/ 2>/dev/null || echo "No models directory found"
	@find models/ -name "*.pkl" -o -name "*.json" 2>/dev/null | head -10 || echo "No model files found"

check-data: ## Verify training data integrity
	@echo "${YELLOW}📋 Checking data integrity...${NC}"
	@for pos in $(POSITIONS); do \
		if [ -f "data/$$pos.csv" ]; then \
			lines=$$(wc -l < "data/$$pos.csv"); \
			size=$$(ls -lh "data/$$pos.csv" | awk '{print $$5}'); \
			echo "✅ $$pos.csv: $$lines lines, $$size"; \
		else \
			echo "❌ Missing: data/$$pos.csv"; \
		fi; \
	done

# Error recovery
recover-data: ## Re-download data if corrupted
	@echo "${YELLOW}🔄 Recovering training data...${NC}"
	rm -f data/*.csv
	$(MAKE) data

recover-models: ## Re-train models if corrupted  
	@echo "${YELLOW}🔄 Recovering model files...${NC}"
	rm -rf models/autogluon_*
	rm -f models/*.pkl
	$(MAKE) train