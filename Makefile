PORT ?= 8080

dev:
	npx live-server --port=$(PORT) --open=/

install:
	npm install -g live-server

.PHONY: dev install
