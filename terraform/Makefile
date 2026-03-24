# Makefile for HyperLiquid Trading Bot (Python Version)

PROJECT_ROOT = $(CURDIR)/../src/hyperliquid_python
DIST_DIR = $(PROJECT_ROOT)/dist

.PHONY: help build deploy plan apply test-signal init

help:
	@echo "Available commands:"
	@echo "  make init    - Initialize Terraform"
	@echo "  make build   - Build python layer and lambda packages"
	@echo "  make plan    - Build and show Terraform plan"
	@echo "  make deploy  - Build and apply Terraform (auto-approve)"
	@echo "  make apply   - Simple terraform apply"
	@echo "  make test-signal - Run Python test script to send a mock signal"

init:
	terraform init

build:
	@echo "🚀 Starting build process..."
	@rm -rf $(DIST_DIR)
	@mkdir -p $(DIST_DIR)/layer/python $(DIST_DIR)/lambdas
	
	@echo "📦 Building Python layer dependencies for AWS (x86_64)..."
	python3 -m pip install -r $(PROJECT_ROOT)/requirements.txt -t $(DIST_DIR)/layer/python \
		--platform manylinux2014_x86_64 --only-binary=:all: --python-version 3.12
	@cd $(DIST_DIR)/layer && zip -q -r ../python_layer.zip python
	
	@echo "🗜️  Creating deployment package..."
	@cp -r $(PROJECT_ROOT)/functions $(DIST_DIR)/lambdas/
	@cp -r $(PROJECT_ROOT)/services $(DIST_DIR)/lambdas/
	@cp -r $(PROJECT_ROOT)/helpers $(DIST_DIR)/lambdas/
	@cp -r $(PROJECT_ROOT)/models $(DIST_DIR)/lambdas/
	@cp -r $(PROJECT_ROOT)/repositories $(DIST_DIR)/lambdas/
	@cp -r $(PROJECT_ROOT)/constants $(DIST_DIR)/lambdas/
	@cd $(DIST_DIR)/lambdas && zip -q -r ../lambdas.zip .
	@echo "✅ Build complete."

plan: build
	terraform plan

deploy: build
	terraform apply --auto-approve

apply:
	terraform apply

test-signal:
	@echo "🧪 Running Python signal test..."
	@python3 $(CURDIR)/../test/test_signal.py
