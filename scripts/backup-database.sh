#!/bin/bash

# ============================================================
# Kibali cha Kuchukua Mafuta - PostgreSQL Backup Script
# Designed for Neon PostgreSQL
# ============================================================

set -u

# Configuration
DATABASE_URL="${DATABASE_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/kibali_mafuta_backup_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# ------------------------------------------------------------
# Check DATABASE_URL
# ------------------------------------------------------------
if [ -z "${DATABASE_URL}" ]; then
    echo "ERROR: DATABASE_URL is not set."
    exit 1
fi

# ------------------------------------------------------------
# Check required commands
# ------------------------------------------------------------
if ! command -v pg_dump >/dev/null 2>&1; then
    echo "ERROR: pg_dump is not installed or not available in PATH."
    exit 1
fi

if ! command -v gzip >/dev/null 2>&1; then
    echo "ERROR: gzip is not installed or not available in PATH."
    exit 1
fi

# ------------------------------------------------------------
# Create backup directory
# ------------------------------------------------------------
mkdir -p "${BACKUP_DIR}"

echo "============================================================"
echo "Starting database backup..."
echo "============================================================"
echo "Backup file: ${COMPRESSED_FILE}"
echo "Retention: ${RETENTION_DAYS} days"

# ------------------------------------------------------------
# Create PostgreSQL backup
# ------------------------------------------------------------
if pg_dump "${DATABASE_URL}" > "${BACKUP_FILE}"; then

    echo "Database dump created successfully."

else

    echo "ERROR: Database backup failed!"

    rm -f "${BACKUP_FILE}"

    exit 1

fi

# ------------------------------------------------------------
# Compress backup
# ------------------------------------------------------------
if gzip "${BACKUP_FILE}"; then

    echo "Backup compressed successfully:"
    echo "${COMPRESSED_FILE}"

else

    echo "ERROR: Backup compression failed!"

    rm -f "${BACKUP_FILE}"
    exit 1

fi

# ------------------------------------------------------------
# Verify compressed backup
# ------------------------------------------------------------
if gzip -t "${COMPRESSED_FILE}"; then

    echo "Backup integrity check: PASSED"

else

    echo "ERROR: Backup integrity check FAILED!"

    rm -f "${COMPRESSED_FILE}"
    exit 1

fi

# ------------------------------------------------------------
# Remove old backups
# ------------------------------------------------------------
find "${BACKUP_DIR}" \
    -name "kibali_mafuta_backup_*.sql.gz" \
    -type f \
    -mtime +"${RETENTION_DAYS}" \
    -delete

echo "Old backups removed."

echo "============================================================"
echo "BACKUP COMPLETED SUCCESSFULLY"
echo "============================================================"

exit 0