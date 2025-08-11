# PredictionPump

A decentralized prediction market platform that combines the viral mechanics of pump.fun with prediction markets. Users can create prediction markets for any event, buy/sell outcome tokens with bonding curve pricing, and earn rewards for accurate predictions.

## Features

- **Dynamic Pricing**: Bonding curve pricing that responds to market sentiment in real-time
- **Social Trading**: Follow top traders, share predictions, and climb leaderboards
- **Automated Settlement**: Oracle-based automatic market resolution
- **Liquidity Provision**: Earn fees by providing market liquidity
- **Mobile Responsive**: Full PWA support for mobile trading

## Tech Stack

- **Smart Contracts**: Solana + Anchor Framework
- **Frontend**: Next.js + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + PostgreSQL + Redis
- **Real-time**: WebSocket connections for live updates
- **Infrastructure**: Docker + Docker Compose

## Getting Started

### Prerequisites

- Node.js 18+
- Rust + Solana CLI
- Docker & Docker Compose
- Anchor CLI

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd prediction-pump
```

2. Install dependencies:
```bash
npm install
cd frontend && npm install
cd ../backend && npm install
```

3. Set up environment variables:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

4. Start the development environment:
```bash
# Start database and services
npm run docker-up

# In separate terminals:
# Start Anchor program
anchor build
anchor deploy

# Start frontend
npm run frontend-dev

# Start backend
npm run backend-dev
```

### Development Commands

```bash
# Build smart contracts
npm run anchor-build

# Run smart contract tests
npm run anchor-test

# Start frontend development server
npm run frontend-dev

# Start backend development server
npm run backend-dev

# Run all tests
npm run test

# Lint all code
npm run lint

# Format all code
npm run format

# Start Docker services
npm run docker-up

# Stop Docker services
npm run docker-down
```

## Project Structure

```
prediction-pump/
├── programs/
│   └── prediction-pump/     # Anchor smart contract
├── frontend/                # Next.js frontend application
├── backend/                 # Node.js backend services
├── tests/                   # Smart contract tests
├── docker-compose.yml       # Docker services configuration
└── package.json            # Root package.json with scripts
```

## Architecture

The application follows a microservices architecture:

- **Smart Contracts**: Handle all trading logic, market creation, and settlement
- **Backend Services**: Provide APIs, real-time data, and social features
- **Frontend**: React-based user interface with wallet integration
- **Database**: PostgreSQL for user data and analytics
- **Cache**: Redis for real-time data and session management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details