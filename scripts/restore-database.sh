#!/bin/bash

# ============================================================
# Kibali cha Kuchukua Mafuta - PostgreSQL Restore Script
# Designed for Neon PostgreSQL
# ============================================================

set -u

# Configuration
DATABASE_URL="${DATABASE_URL:-}"

# ------------------------------------------------------------
# Check DATABASE_URL
# ------------------------------------------------------------
if [ -z "${DATABASE_URL}" ]; then
    echo "ERROR: DATABASE_URL is not set."
    exit 1
fi

# ------------------------------------------------------------
# Check backup argument
# ------------------------------------------------------------
if [ -z "${1:-}" ]; then

    echo "Usage:"
    echo "$0 <backup_file.sql.gz>"

    echo ""
    echo "Example:"
    echo "$0 ./backups/kibali_mafuta_backup_20260901_120000.sql.gz"

    exit 1

fi

BACKUP_FILE="$1"

# ------------------------------------------------------------
# Check backup file
# ------------------------------------------------------------
if [ ! -f "${BACKUP_FILE}" ]; then

    echo "ERROR: Backup file not found:"
    echo "${BACKUP_FILE}"

    exit 1

fi

# ------------------------------------------------------------
# Check required commands
# ------------------------------------------------------------
if ! command -v psql >/dev/null 2>&1; then

    echo "ERROR: psql is not installed or not available in PATH."

    exit 1

fi

if ! command -v gzip >/dev/null 2>&1; then

    echo "ERROR: gzip is not installed or not available in PATH."

    exit 1

fi

# ------------------------------------------------------------
# Temporary restore file
# ------------------------------------------------------------
TEMP_FILE=$(mktemp)

# Cleanup temporary file when script exits
cleanup() {
    rm -f "${TEMP_FILE}"
}

trap cleanup EXIT

echo "============================================================"
echo "Starting database restore..."
echo "============================================================"
echo "Backup file: ${BACKUP_FILE}"

# ------------------------------------------------------------
# Verify backup integrity
# ------------------------------------------------------------
echo "Checking backup integrity..."

if ! gzip -t "${BACKUP_FILE}"; then

    echo "ERROR: Backup file is corrupted or invalid."

    exit 1

fi

echo "Backup integrity: PASSED"

# ------------------------------------------------------------
# Decompress backup
# ------------------------------------------------------------
echo "Decompressing backup..."

if ! gunzip -c "${BACKUP_FILE}" > "${TEMP_FILE}"; then

    echo "ERROR: Failed to decompress backup."

    exit 1

fi

# ------------------------------------------------------------
# Confirmation
# ------------------------------------------------------------
echo ""
echo "WARNING!"
echo "This will restore data into the PostgreSQL database"
echo "specified by DATABASE_URL."
echo ""
read -r -p "Continue with database restore? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then

    echo "Restore cancelled."

    exit 0

fi

# ------------------------------------------------------------
# Restore database
# ------------------------------------------------------------
echo ""
echo "Restoring database..."

if psql "${DATABASE_URL}" < "${TEMP_FILE}"; then

    echo ""
    echo "============================================================"
    echo "DATABASE RESTORE COMPLETED SUCCESSFULLY"
    echo "============================================================"

else

    echo ""
    echo "============================================================"
    echo "ERROR: DATABASE RESTORE FAILED"
    echo "============================================================"

    exit 1

fi

exit 0