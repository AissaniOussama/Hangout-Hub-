# generate-dev-keys.ps1
# Generates RSA key pair for JWT signing in development.
# Run once before starting the backend for the first time.
#
# Usage (from the project root):
#   .\scripts\generate-dev-keys.ps1
#
# Requires OpenSSL. Checked in this order:
#   1. openssl already on PATH  (standalone install, Chocolatey, winget, ...)
#   2. C:\Program Files\Git\usr\bin\openssl.exe  (bundled with Git for Windows)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$KeysDir     = Join-Path $ProjectRoot "backend\src\main\resources"

# Locate openssl ---------------------------------------------------------------
$OpenSSL = $null

if (Get-Command openssl -ErrorAction SilentlyContinue) {
    $OpenSSL = "openssl"
} else {
    $GitOpenSSL = "C:\Program Files\Git\usr\bin\openssl.exe"
    if (Test-Path $GitOpenSSL) {
        $OpenSSL = $GitOpenSSL
    }
}

if (-not $OpenSSL) {
    Write-Error @"
OpenSSL was not found. Install one of the following and re-run:
  - Git for Windows  : https://git-scm.com/download/win  (includes OpenSSL)
  - Chocolatey       : choco install openssl
  - winget           : winget install ShiningLight.OpenSSL
"@
    exit 1
}

Write-Host "Using OpenSSL: $OpenSSL"
Write-Host "Generating RSA key pair in $KeysDir ..."

# File paths -------------------------------------------------------------------
$Raw     = Join-Path $KeysDir "rsaPrivateKey.pem"
$PubKey  = Join-Path $KeysDir "publicKey.pem"
$PrivKey = Join-Path $KeysDir "privateKey.pem"

# Generate ---------------------------------------------------------------------
& $OpenSSL genrsa -out $Raw 2048
& $OpenSSL rsa    -pubout -in $Raw -out $PubKey
& $OpenSSL pkcs8  -topk8 -nocrypt -inform pem -in $Raw -outform pem -out $PrivKey
Remove-Item $Raw

Write-Host ""
Write-Host "Done."
Write-Host "  $PrivKey"
Write-Host "  $PubKey"
Write-Host ""
Write-Host "These files are gitignored - do NOT commit them."
