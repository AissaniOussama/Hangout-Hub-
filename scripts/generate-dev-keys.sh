#!/usr/bin/env bash
# Generates RSA key pair for JWT signing in development.
# Run once before starting the backend for the first time.
set -euo pipefail

KEYS_DIR="backend/src/main/resources"

cd "$(dirname "$0")/.."

echo "Generating RSA key pair in ${KEYS_DIR}/ ..."
openssl genrsa -out "${KEYS_DIR}/rsaPrivateKey.pem" 2048
openssl rsa  -pubout -in "${KEYS_DIR}/rsaPrivateKey.pem" -out "${KEYS_DIR}/publicKey.pem"
openssl pkcs8 -topk8 -nocrypt \
  -inform pem -in "${KEYS_DIR}/rsaPrivateKey.pem" \
  -outform pem -out "${KEYS_DIR}/privateKey.pem"
rm "${KEYS_DIR}/rsaPrivateKey.pem"

echo "Done. Keys written to ${KEYS_DIR}/privateKey.pem and publicKey.pem"
echo "These files are gitignored — do NOT commit them."
