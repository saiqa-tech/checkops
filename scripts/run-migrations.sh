#!/bin/bash

# CheckOps v4.0.0 Migration Runner
# Executes all migration files in sequence using psql

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Database configuration from environment or defaults
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-checkops}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         CheckOps v4.0.0 Migration Runner                  ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

# Change to script directory
cd "$(dirname "$0")/.."

# Test connection
echo -e "${CYAN}Testing database connection...${NC}"
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}Starting migration...${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# Run migrations in sequence
migrations=(
    "006_add_uuid_columns.sql"
    "007_migrate_foreign_keys.sql"
    "008_swap_primary_keys.sql"
    "009_cleanup_and_optimize.sql"
    "010_add_form_sid_to_submissions.sql"
)

step=1
total=${#migrations[@]}

for migration in "${migrations[@]}"; do
    echo -e "${CYAN}[$step/$total] Running $migration...${NC}"
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "migrations/$migration" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $migration completed${NC}"
    else
        echo -e "${RED}✗ $migration failed${NC}"
        echo ""
        echo -e "${RED}Migration failed! Rolling back...${NC}"
        echo -e "${YELLOW}Run rollback: psql -U $DB_USER -d $DB_NAME -f migrations/rollback_v4.sql${NC}"
        exit 1
    fi
    
    ((step++))
done

echo ""
echo -e "${CYAN}[6/6] Verifying migration...${NC}"

# Verify schema
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT 
        table_name,
        column_name,
        data_type
    FROM information_schema.columns
    WHERE table_name IN ('forms', 'question_bank', 'submissions')
        AND column_name IN ('id', 'sid')
    ORDER BY table_name, column_name;
" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Schema verification passed${NC}"
else
    echo -e "${RED}✗ Schema verification failed${NC}"
    exit 1
fi

# Check foreign key integrity
violations=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*)
    FROM submissions s
    LEFT JOIN forms f ON s.form_id = f.id
    WHERE f.id IS NULL;
" | tr -d ' ')

if [ "$violations" -eq 0 ]; then
    echo -e "${GREEN}✓ Foreign key integrity verified${NC}"
else
    echo -e "${RED}✗ $violations foreign key violation(s) detected${NC}"
    exit 1
fi

# Get record counts
forms_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM forms;" | tr -d ' ')
questions_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM question_bank;" | tr -d ' ')
submissions_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM submissions;" | tr -d ' ')

echo ""
echo "Record counts:"
echo "  Forms: $forms_count"
echo "  Questions: $questions_count"
echo "  Submissions: $submissions_count"

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}✓ Migration completed successfully!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Run integration tests: npm test -- tests/integration"
echo "  2. Update performance tests if integration tests pass"
echo "  3. Run full test suite: npm test"
echo ""

# Unset password
unset PGPASSWORD
