#!/bin/bash

# Database Restore Script for Kibali cha Kuchukua Mafuta
# Restores a PostgreSQL database from a compressed backup file

set -e

echo "============================================================"
echo "Starting database restore..."
echo "============================================================"

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set!"
    exit 1
fi

# Check backup file argument
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Example:"
    echo "$0 kibali_mafuta_backup_20260901_120000.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

# Check backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found:"
    echo "$BACKUP_FILE"
    exit 1
fi

echo "Backup file:"
echo "$BACKUP_FILE"

# Check backup integrity
echo ""
echo "Checking backup integrity..."

gunzip -t "$BACKUP_FILE"

echo "Backup integrity check: PASSED"

# Create temporary SQL file
TEMP_FILE="/tmp/kibali_mafuta_restore_$(date +%s).sql"

echo ""
echo "Decompressing backup..."

gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"

echo "Backup decompressed successfully."

# Restore database
echo ""
echo "Restoring database..."

psql "$DATABASE_URL" < "$TEMP_FILE"

echo ""
echo "Cleaning temporary files..."

rm -f "$TEMP_FILE"

echo ""
echo "============================================================"
echo "DATABASE RESTORE COMPLETED SUCCESSFULLY"
echo "============================================================"
