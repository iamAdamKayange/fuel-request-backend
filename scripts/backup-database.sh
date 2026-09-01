#!/bin/bash

# Database Backup Script for Kibali cha Kuchukua Mafuta

set -e

echo "============================================================"
echo "Starting database backup..."
echo "============================================================"

# Check required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set!"
    exit 1
fi

if [ -z "$R2_ACCESS_KEY_ID" ]; then
    echo "ERROR: R2_ACCESS_KEY_ID is not set!"
    exit 1
fi

if [ -z "$R2_SECRET_ACCESS_KEY" ]; then
    echo "ERROR: R2_SECRET_ACCESS_KEY is not set!"
    exit 1
fi

if [ -z "$R2_ENDPOINT" ]; then
    echo "ERROR: R2_ENDPOINT is not set!"
    exit 1
fi

if [ -z "$R2_BUCKET" ]; then
    echo "ERROR: R2_BUCKET is not set!"
    exit 1
fi

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/kibali_mafuta_backup_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

echo "Backup file: ${BACKUP_FILE}"
echo "Retention: ${RETENTION_DAYS} days"

# Create PostgreSQL backup
echo ""
echo "Creating PostgreSQL backup..."

pg_dump "$DATABASE_URL" > "${BACKUP_FILE}"

echo "Database dump created successfully."

# Compress backup
echo ""
echo "Compressing backup..."

gzip "${BACKUP_FILE}"

BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

echo "Backup compressed successfully:"
echo "${BACKUP_FILE_GZ}"

# Verify backup integrity
echo ""
echo "Checking backup integrity..."

gunzip -t "${BACKUP_FILE_GZ}"

echo "Backup integrity check: PASSED"

# Upload to Cloudflare R2
echo ""
echo "Uploading backup to Cloudflare R2..."

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"

aws s3 cp \
    "${BACKUP_FILE_GZ}" \
    "s3://${R2_BUCKET}/$(basename "${BACKUP_FILE_GZ}")" \
    --endpoint-url "${R2_ENDPOINT}"

echo "Backup uploaded successfully to Cloudflare R2."

# Remove local backups older than retention period
echo ""
echo "Cleaning old local backups..."

find "${BACKUP_DIR}" \
    -name "kibali_mafuta_backup_*.sql.gz" \
    -type f \
    -mtime +${RETENTION_DAYS} \
    -delete

echo "Old local backups removed."

echo ""
echo "============================================================"
echo "BACKUP COMPLETED SUCCESSFULLY"
echo "============================================================"
