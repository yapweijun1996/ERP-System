#!/bin/bash

# ============================================
# Nexus ERP Database Setup Script
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="nexus_erp"
DB_USER="${DB_USER:-$USER}"  # Use current user by default
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Nexus ERP Database Setup Wizard     ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Function to print step
print_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Step 1: Check PostgreSQL installation
print_step "Step 1: Checking PostgreSQL installation..."
if command -v psql &> /dev/null; then
    PG_VERSION=$(psql --version | awk '{print $3}')
    print_success "PostgreSQL $PG_VERSION detected"
else
    print_error "PostgreSQL not found. Please install PostgreSQL first."
    exit 1
fi

# Step 2: Check PostgreSQL service
print_step "Step 2: Checking PostgreSQL service status..."
if pg_isready -h $DB_HOST -p $DB_PORT &> /dev/null; then
    print_success "PostgreSQL is running on $DB_HOST:$DB_PORT"
else
    print_error "PostgreSQL is not running. Please start the service."
    echo "  Try: brew services start postgresql@18"
    exit 1
fi

# Step 3: Ask user for database action
echo ""
echo -e "${YELLOW}What would you like to do?${NC}"
echo "  1) Create new database '$DB_NAME'"
echo "  2) Use existing database '$DB_NAME'"
echo "  3) Drop and recreate database '$DB_NAME' (⚠️  WARNING: All data will be lost!)"
echo "  4) Exit"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        print_step "Creating new database '$DB_NAME'..."
        if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
            print_error "Database '$DB_NAME' already exists!"
            echo "  Please choose option 2 or 3."
            exit 1
        fi
        createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
        print_success "Database '$DB_NAME' created"
        RUN_MIGRATIONS=true
        ;;
    2)
        print_step "Checking existing database '$DB_NAME'..."
        if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
            print_error "Database '$DB_NAME' does not exist!"
            echo "  Please choose option 1 to create it."
            exit 1
        fi
        print_success "Database '$DB_NAME' found"
        echo ""
        read -p "Do you want to run migrations? (y/n): " run_mig
        if [[ $run_mig == "y" || $run_mig == "Y" ]]; then
            RUN_MIGRATIONS=true
        else
            RUN_MIGRATIONS=false
        fi
        ;;
    3)
        print_step "Dropping database '$DB_NAME'..."
        dropdb -h $DB_HOST -p $DB_PORT -U $DB_USER --if-exists $DB_NAME
        print_success "Database dropped"
        
        print_step "Creating new database '$DB_NAME'..."
        createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
        print_success "Database '$DB_NAME' created"
        RUN_MIGRATIONS=true
        ;;
    4)
        echo "Exiting..."
        exit 0
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

# Step 4: Run migrations
if [ "$RUN_MIGRATIONS" = true ]; then
    echo ""
    print_step "Step 4: Running database migrations..."
    
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    MIGRATIONS_DIR="$SCRIPT_DIR/migrations"
    
    if [ ! -d "$MIGRATIONS_DIR" ]; then
        print_error "Migrations directory not found: $MIGRATIONS_DIR"
        exit 1
    fi
    
    # Run schema migration
    if [ -f "$MIGRATIONS_DIR/001_init_schema.sql" ]; then
        print_step "  Running 001_init_schema.sql..."
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$MIGRATIONS_DIR/001_init_schema.sql" > /dev/null 2>&1
        print_success "  Schema created"
    fi
    
    # Ask about seed data
    echo ""
    read -p "Do you want to load demo seed data? (y/n): " load_seed
    if [[ $load_seed == "y" || $load_seed == "Y" ]]; then
        if [ -f "$MIGRATIONS_DIR/002_seed_data.sql" ]; then
            print_step "  Running 002_seed_data.sql..."
            psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$MIGRATIONS_DIR/002_seed_data.sql" > /dev/null 2>&1
            print_success "  Seed data loaded"
        fi
    fi
fi

# Step 5: Create .env file
echo ""
print_step "Step 5: Creating environment configuration..."

ENV_FILE="$SCRIPT_DIR/../server/.env"
mkdir -p "$SCRIPT_DIR/../server"

cat > "$ENV_FILE" << EOF
# Database Configuration
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=

# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Secret (change this in production!)
JWT_SECRET=$(openssl rand -base64 32)

# CORS
CORS_ORIGIN=http://localhost:5173
EOF

print_success "Environment file created: $ENV_FILE"

# Step 6: Test connection
echo ""
print_step "Step 6: Testing database connection..."
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM tenants;" > /dev/null 2>&1; then
    print_success "Database connection successful!"
else
    print_error "Database connection failed"
    exit 1
fi

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Setup Completed Successfully!     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Database Information:${NC}"
echo "  Database: $DB_NAME"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  User: $DB_USER"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "  1. Install backend dependencies:"
echo "     cd server && npm install"
echo ""
echo "  2. Start the backend server:"
echo "     cd server && npm run dev"
echo ""
echo "  3. Update frontend to use API:"
echo "     Edit .env.local to set VITE_API_URL=http://localhost:3001"
echo ""
echo -e "${BLUE}🔐 Demo Login Credentials:${NC}"
if [ "$load_seed" = "y" ] || [ "$load_seed" = "Y" ]; then
    echo "  Platform Admin: super@nexuserp.io / password"
    echo "  Tenant Admin:   alice@techflow.com / password"
    echo "  Sales Manager:  bob@techflow.com / password"
fi
echo ""
