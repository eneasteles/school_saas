#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3333}"
SCHOOL_CODE="${SCHOOL_CODE:-}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"
SCHOOL_NAME="${SCHOOL_NAME:-Escola Demo}"
REGISTER_IF_MISSING="${REGISTER_IF_MISSING:-0}"

if [[ -z "$SCHOOL_CODE" || -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "Uso:"
  echo "  SCHOOL_CODE=... EMAIL=... PASSWORD=... [API_BASE=http://127.0.0.1:3333] $0"
  echo
  echo "Opcional:"
  echo "  REGISTER_IF_MISSING=1 SCHOOL_NAME='Minha Escola'"
  exit 1
fi

extract_json_field() {
  local json="$1"
  local field="$2"
  if command -v jq >/dev/null 2>&1; then
    jq -r ".$field // empty" <<<"$json"
  else
    sed -nE "s/.*\"$field\":\"?([^\",}]*)\"?.*/\\1/p" <<<"$json" | head -n 1
  fi
}

http_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local auth="${4:-}"

  local tmp_body
  local http_code
  tmp_body="$(mktemp)"

  if [[ -n "$auth" ]]; then
    http_code="$(curl -sS -o "$tmp_body" -w "%{http_code}" \
      -X "$method" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $auth" \
      "$url" \
      ${body:+-d "$body"})"
  else
    http_code="$(curl -sS -o "$tmp_body" -w "%{http_code}" \
      -X "$method" \
      -H "Content-Type: application/json" \
      "$url" \
      ${body:+-d "$body"})"
  fi

  local response
  response="$(cat "$tmp_body")"
  rm -f "$tmp_body"

  printf '%s\n%s\n' "$http_code" "$response"
}

login_body="$(printf '{"school_code":"%s","email":"%s","password":"%s"}' "$SCHOOL_CODE" "$EMAIL" "$PASSWORD")"
readarray -t login_out < <(http_json "POST" "$API_BASE/auth/login" "$login_body")
login_code="${login_out[0]}"
login_response="${login_out[1]}"

if [[ "$login_code" != "200" && "$REGISTER_IF_MISSING" == "1" ]]; then
  register_body="$(printf '{"school_name":"%s","school_code":"%s","email":"%s","password":"%s"}' "$SCHOOL_NAME" "$SCHOOL_CODE" "$EMAIL" "$PASSWORD")"
  readarray -t reg_out < <(http_json "POST" "$API_BASE/auth/register" "$register_body")
  reg_code="${reg_out[0]}"
  reg_response="${reg_out[1]}"
  echo "REGISTER status: $reg_code"
  echo "REGISTER body: $reg_response"

  if [[ "$reg_code" != "200" ]]; then
    echo "Falha ao registrar; abortando."
    exit 1
  fi

  readarray -t login_out < <(http_json "POST" "$API_BASE/auth/login" "$login_body")
  login_code="${login_out[0]}"
  login_response="${login_out[1]}"
fi

echo "LOGIN status: $login_code"
echo "LOGIN body: $login_response"

if [[ "$login_code" != "200" ]]; then
  echo "Falha no login; abortando."
  exit 1
fi

token="$(extract_json_field "$login_response" "token")"
if [[ -z "$token" ]]; then
  echo "Token não encontrado na resposta de login."
  exit 1
fi

suffix="$(date +%s)"
class_name="Turma Script $suffix"
create_body="$(printf '{"name":"%s","grade":"1 ano","year":2026}' "$class_name")"
readarray -t create_out < <(http_json "POST" "$API_BASE/classes" "$create_body" "$token")
create_code="${create_out[0]}"
create_response="${create_out[1]}"

echo "CREATE /classes status: $create_code"
echo "CREATE /classes body: $create_response"

if [[ "$create_code" != "200" ]]; then
  echo "Falha ao criar turma; abortando."
  exit 1
fi

class_id="$(extract_json_field "$create_response" "id")"
if [[ -z "$class_id" ]]; then
  echo "class_id não encontrado na resposta de criação."
  exit 1
fi

readarray -t list_out < <(http_json "GET" "$API_BASE/classes" "" "$token")
list_code="${list_out[0]}"
list_response="${list_out[1]}"
echo "GET /classes status: $list_code"
echo "GET /classes body: $list_response"

readarray -t del_out < <(http_json "DELETE" "$API_BASE/classes/$class_id" "" "$token")
del_code="${del_out[0]}"
del_response="${del_out[1]}"
echo "DELETE /classes/$class_id status: $del_code"
echo "DELETE /classes/$class_id body: $del_response"

if [[ "$del_code" != "200" ]]; then
  echo "Falha ao deletar turma."
  exit 1
fi

echo "Fluxo concluído com sucesso."
