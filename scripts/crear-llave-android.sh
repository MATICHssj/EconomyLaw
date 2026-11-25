#!/usr/bin/env bash
# Crea TU llave de firma de Android (una sola vez) y te dice qué pegar en GitHub.
#
# Por qué: con la misma llave, cada versión nueva del APK se instala ENCIMA de la
# anterior (sin desinstalar ni perder datos) y Google Play la acepta.
# ¡Guarda el archivo .keystore y la contraseña en un lugar seguro! Si los pierdes,
# no podrás publicar actualizaciones de la misma app.
#
# Requisitos: Java (keytool). Viene con Android Studio o con "sudo apt install openjdk-21-jdk".
# Uso:  bash scripts/crear-llave-android.sh
set -euo pipefail

OUT="${1:-$HOME/fina-llave.keystore}"
ALIAS="fina"

if [ -e "$OUT" ]; then
  echo "Ya existe $OUT. No la sobrescribo (borrarla te impediría actualizar la app)." >&2
  exit 1
fi
command -v keytool >/dev/null || { echo "No encontré keytool. Instala Java (JDK) y vuelve a intentar." >&2; exit 1; }

read -r -s -p "Elige una contraseña para la llave (mínimo 8 caracteres): " PASS; echo
read -r -s -p "Repítela: " PASS2; echo
[ "$PASS" = "$PASS2" ] || { echo "No coinciden." >&2; exit 1; }
[ "${#PASS}" -ge 8 ] || { echo "Muy corta." >&2; exit 1; }

keytool -genkeypair -v -keystore "$OUT" -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=Fina, O=Fina, C=MX" >/dev/null 2>&1

B64="$OUT.base64.txt"
base64 < "$OUT" | tr -d '\n' > "$B64"
chmod 600 "$OUT" "$B64"

cat <<MSG

Listo. Se creó tu llave: $OUT

Ahora en GitHub → tu repositorio → Settings → Secrets and variables → Actions →
"New repository secret", crea estos 4 secretos:

  ANDROID_KEYSTORE_BASE64   → pega TODO el contenido del archivo $B64
  ANDROID_KEYSTORE_PASSWORD → la contraseña que elegiste
  ANDROID_KEY_ALIAS         → $ALIAS
  ANDROID_KEY_PASSWORD      → la misma contraseña

Después borra $B64 (el .keystore guárdalo en un lugar seguro, p. ej. tu Drive personal).
Nunca subas el .keystore al repositorio ni lo pegues en un chat.
MSG
