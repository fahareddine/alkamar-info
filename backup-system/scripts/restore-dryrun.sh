#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# restore-dryrun.sh — Test non-destructif de restauration
#
# Ce script LISTE et VÉRIFIE les backups disponibles sans rien restaurer.
# Ne touche pas à la production. Ne modifie aucune donnée.
#
# Usage :
#   ./restore-dryrun.sh [--source local|b2|github|gdrive]
#
# Variables d'environnement requises :
#   GPG_PASSPHRASE          : pour tester le déchiffrement
#   RCLONE_B2_ACCOUNT       : compte Backblaze B2
#   RCLONE_B2_KEY           : clé Backblaze B2
#   RCLONE_GDRIVE_TOKEN     : token Google Drive
#   B2_BUCKET               : nom du bucket (défaut: info-experts-alkamar-backups)
#   BACKUP_REPO             : repo GitHub (défaut: fahareddine/info-experts-alkamar-backups)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SNAPSHOT_DIR="${SCRIPT_DIR}/../snapshots"
SOURCE="${1:-local}"
B2_BUCKET="${B2_BUCKET:-info-experts-alkamar-backups}"
BACKUP_REPO="${BACKUP_REPO:-fahareddine/info-experts-alkamar-backups}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠  $*${NC}"; }
fail() { echo -e "${RED}❌ $*${NC}"; }
info() { echo -e "   $*"; }

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  RESTORE DRY-RUN — Test non-destructif d'intégrité backup"
echo "  Source : ${SOURCE} | Date : $(date)"
echo "════════════════════════════════════════════════════════════════"
echo ""

ERRORS=0

# ── 1. Vérifier les outils nécessaires ───────────────────────────────────────
echo "── Outils requis ────────────────────────────────────────────────"
for tool in gpg tar jq; do
  if command -v "$tool" &>/dev/null; then
    ok "$tool disponible ($(${tool} --version 2>&1 | head -1))"
  else
    fail "$tool manquant — installation requise"
    ((ERRORS++))
  fi
done

if command -v rclone &>/dev/null; then
  ok "rclone disponible"
else
  warn "rclone absent — nécessaire pour B2/GDrive"
fi

if command -v gh &>/dev/null; then
  ok "gh CLI disponible"
else
  warn "gh CLI absent — nécessaire pour GitHub Releases"
fi
echo ""

# ── 2. Backups locaux ─────────────────────────────────────────────────────────
echo "── Snapshots locaux ─────────────────────────────────────────────"
if [[ -d "$SNAPSHOT_DIR" ]]; then
  ARCHIVES=$(find "$SNAPSHOT_DIR" -name "*.gpg" -o -name "*.tar.gz" 2>/dev/null | sort)
  if [[ -n "$ARCHIVES" ]]; then
    COUNT=$(echo "$ARCHIVES" | wc -l)
    ok "$COUNT archive(s) locale(s) trouvée(s)"
    echo "$ARCHIVES" | while read -r f; do
      SIZE=$(du -sh "$f" 2>/dev/null | cut -f1)
      info "  $(basename "$f") — $SIZE"
    done
    LATEST=$(echo "$ARCHIVES" | tail -1)
    info "Dernier backup : $LATEST"

    # Vérifier intégrité GPG sans déchiffrer
    if [[ "$LATEST" == *.gpg ]] && [[ -n "${GPG_PASSPHRASE:-}" ]]; then
      echo ""
      info "Test déchiffrement GPG (dry-run)..."
      if echo "$GPG_PASSPHRASE" | gpg --batch --passphrase-fd 0 --output /dev/null --decrypt "$LATEST" 2>/dev/null; then
        ok "Archive GPG déchiffrable correctement"
      else
        fail "Échec déchiffrement — passphrase incorrecte ou archive corrompue"
        ((ERRORS++))
      fi
    elif [[ "$LATEST" == *.gpg ]]; then
      warn "GPG_PASSPHRASE non définie — déchiffrement non testé"
    fi
  else
    warn "Aucune archive locale trouvée dans $SNAPSHOT_DIR"
  fi
else
  warn "Dossier snapshots absent : $SNAPSHOT_DIR"
fi
echo ""

# ── 3. Listing B2 (dry-run, pas de téléchargement) ───────────────────────────
echo "── Backups Backblaze B2 ─────────────────────────────────────────"
if command -v rclone &>/dev/null && [[ -n "${RCLONE_B2_ACCOUNT:-}" ]]; then
  info "Listing B2 bucket: b2:${B2_BUCKET}"
  if rclone ls "b2:${B2_BUCKET}" --max-depth 1 2>/dev/null | head -20; then
    ok "B2 accessible — listing réussi"
  else
    fail "B2 inaccessible — vérifier RCLONE_B2_ACCOUNT / RCLONE_B2_KEY"
    ((ERRORS++))
  fi
else
  warn "rclone ou RCLONE_B2_ACCOUNT absent — B2 non testé"
  info "Pour tester manuellement :"
  info "  export RCLONE_B2_ACCOUNT=<account>"
  info "  export RCLONE_B2_KEY=<key>"
  info "  rclone ls b2:${B2_BUCKET} --max-depth 2"
fi
echo ""

# ── 4. Listing GitHub Releases (dry-run) ─────────────────────────────────────
echo "── Backups GitHub Releases ──────────────────────────────────────"
if command -v gh &>/dev/null; then
  info "Listing releases : $BACKUP_REPO"
  if gh release list --repo "$BACKUP_REPO" --limit 5 2>/dev/null; then
    ok "GitHub Releases accessible"
  else
    warn "GitHub Releases non accessible (auth requise ou repo privé)"
    info "Pour tester : gh release list --repo $BACKUP_REPO"
  fi
else
  warn "gh CLI absent"
  info "Pour tester : gh release list --repo $BACKUP_REPO --limit 5"
fi
echo ""

# ── 5. Vérification migrations SQL ───────────────────────────────────────────
echo "── Migrations Supabase ──────────────────────────────────────────"
MIGRATIONS_DIR="${SCRIPT_DIR}/../../supabase/migrations"
if [[ -d "$MIGRATIONS_DIR" ]]; then
  MIGS=$(find "$MIGRATIONS_DIR" -name "*.sql" | sort)
  COUNT=$(echo "$MIGS" | wc -l)
  ok "$COUNT migration(s) SQL trouvée(s)"
  echo "$MIGS" | while read -r m; do
    SIZE=$(wc -l < "$m")
    info "  $(basename "$m") — $SIZE lignes"
  done
else
  fail "Dossier migrations absent : $MIGRATIONS_DIR"
  ((ERRORS++))
fi
echo ""

# ── 6. Vérification script restore principal ─────────────────────────────────
echo "── Script de restauration ───────────────────────────────────────"
RESTORE_SCRIPT="${SCRIPT_DIR}/restore.sh"
if [[ -f "$RESTORE_SCRIPT" ]]; then
  ok "restore.sh présent"
  info "Pour lister les snapshots disponibles (sans restaurer) :"
  info "  ./restore.sh --list --from b2"
  info "  ./restore.sh --list --from github"
else
  fail "restore.sh absent"
  ((ERRORS++))
fi
echo ""

# ── Résumé ─────────────────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════════"
if [[ $ERRORS -eq 0 ]]; then
  ok "DRY-RUN RÉUSSI — Aucune erreur critique détectée"
else
  fail "DRY-RUN : $ERRORS erreur(s) critique(s) — voir détails ci-dessus"
fi
echo ""
echo "⚠  Ce script ne restaure rien en production."
echo "   Pour une restauration réelle : ./restore.sh --from b2 --snapshot <TS>"
echo "════════════════════════════════════════════════════════════════"

exit $ERRORS
