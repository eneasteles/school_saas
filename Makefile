.PHONY: help api-smoke

help:
	@echo "Targets:"
	@echo "  api-smoke  Run backend classes smoke test flow"
	@echo
	@echo "Usage:"
	@echo "  make api-smoke SCHOOL_CODE=escola-x EMAIL=owner@escolax.com PASSWORD=12345678"
	@echo "Optional:"
	@echo "  API_BASE=http://127.0.0.1:3333 REGISTER_IF_MISSING=1 SCHOOL_NAME='Escola X'"

api-smoke:
	@API_BASE="$${API_BASE:-http://127.0.0.1:3333}" \
	SCHOOL_CODE="$${SCHOOL_CODE:-}" \
	EMAIL="$${EMAIL:-}" \
	PASSWORD="$${PASSWORD:-}" \
	SCHOOL_NAME="$${SCHOOL_NAME:-Escola Demo}" \
	REGISTER_IF_MISSING="$${REGISTER_IF_MISSING:-0}" \
	./backend/scripts/test_classes_flow.sh
