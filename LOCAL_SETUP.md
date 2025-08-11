# Local Development Setup (Without Docker)

Since Docker isn't installed, here's how to run the development environment locally:

## Prerequisites

1. **Node.js 18+** (check with `node --version`)
2. **PostgreSQL** (optional for now - backend will work without it)
3. **Rust + Solana CLI** (for smart contracts)

## Quick Start

### 1. Install all dependencies
```bash
npm run install-all
```

### 2. Start Frontend (Terminal 1)
```bash
npm run frontend-dev
```
This will start the Next.js frontend on http://localhost:3000

### 3. Start Backend (Terminal 2)
```bash
npm run backend-dev
```
This will start the Express backend on http://localhost:3001

### 4. Smart Contract Development (Optional)
```bash
# Build contracts
npm run anchor-build

# Test contracts (requires Solana CLI)
npm run anchor-test
```

## Database Setup (Optional)

For now, the backend will run without a database. When you're ready to add database functionality:

### Option A: Install PostgreSQL locally
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres createdb prediction_pump
```

### Option B: Use a cloud database
- **Supabase** (free tier): https://supabase.com
- **Railway** (free tier): https://railway.app
- **Neon** (free tier): https://neon.tech

Update `backend/.env` with your database URL:
```
DATABASE_URL=postgresql://username:password@host:port/database_name
```

## Development Workflow

1. **Frontend Development**: Make changes in `frontend/src/` - hot reload is enabled
2. **Backend Development**: Make changes in `backend/src/` - nodemon will restart the server
3. **Smart Contracts**: Make changes in `programs/prediction-pump/src/` - rebuild with `anchor build`

## Troubleshooting

### Port conflicts
- Frontend: Change port in `frontend/package.json` dev script
- Backend: Change PORT in `backend/.env`

### Missing dependencies
```bash
# If you get module not found errors
npm run install-all
```

### Database connection errors
The backend is configured to work without a database initially. Database-dependent features will be disabled until you set up PostgreSQL.

## Next Steps

Once you have the basic setup running:
1. Install Docker for the full containerized experience
2. Set up a PostgreSQL database
3. Configure Solana CLI for smart contract development