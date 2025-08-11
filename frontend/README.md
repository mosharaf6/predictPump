# PredictionPump Frontend

A decentralized prediction markets platform built on Solana with viral mechanics and bonding curve pricing.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Solana wallet (Phantom or Solflare recommended)

### Installation

1. Clone the repository and navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env.local
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🔗 Solana Wallet Setup

This application requires a **Solana wallet** (not Ethereum wallets like MetaMask).

### Recommended Wallets:

1. **Phantom Wallet** (Most Popular)
   - Visit: https://phantom.app
   - Install the browser extension
   - Create or import a wallet
   - Switch to Devnet for testing

2. **Solflare Wallet**
   - Visit: https://solflare.com
   - Install the browser extension
   - Create or import a wallet
   - Switch to Devnet for testing

### Setting up for Development:

1. Install a Solana wallet extension
2. Create a new wallet or import existing one
3. Switch to **Devnet** network (for testing)
4. Get some devnet SOL from a faucet:
   - https://faucet.solana.com
   - https://solfaucet.com

## 🎯 Features

- **Wallet Integration**: Connect with multiple Solana wallets
- **Market Discovery**: Browse and filter prediction markets
- **Real-time Trading**: Buy/sell outcome tokens with dynamic pricing
- **Price Charts**: Interactive charts with technical indicators
- **Portfolio Tracking**: View positions and P&L
- **Responsive Design**: Works on desktop and mobile

## 🛠 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm test` - Run tests

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file with:

```env
# Solana Network Configuration
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# Program IDs (update with deployed program addresses)
NEXT_PUBLIC_PREDICTION_PUMP_PROGRAM_ID=

# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

## 🐛 Troubleshooting

### "Connect Wallet" button not working?
- Make sure you have a **Solana wallet** installed (not MetaMask)
- Try refreshing the page after installing the wallet
- Check that the wallet is set to Devnet

### "Maximum update depth exceeded" error?
- This should be fixed in the latest version
- Try clearing browser cache and refreshing

### Pino-pretty warnings?
- These are harmless warnings from wallet dependencies
- They don't affect functionality

## 🏗 Architecture

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Solana Wallet Adapter** - Wallet integration
- **Recharts** - Charts and data visualization

## 📱 Mobile Support

The application is fully responsive and works on:
- Desktop browsers
- Mobile browsers
- Tablet devices

## 🔐 Security

- All wallet interactions use official Solana Wallet Adapter
- Private keys never leave your wallet
- Transactions require explicit user approval
- No sensitive data is stored on our servers

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.