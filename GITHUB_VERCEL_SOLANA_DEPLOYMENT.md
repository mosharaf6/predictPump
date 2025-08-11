# GitHub, Solana & Vercel Deployment Guide

This guide will walk you through deploying PredictionPump to GitHub, deploying smart contracts to Solana, and hosting the frontend on Vercel.

## Prerequisites

### Required Tools
- Git
- Node.js 18+
- Solana CLI
- Anchor CLI
- GitHub account
- Vercel account
- Solana wallet with SOL for deployment

### Install Required Tools

#### 1. Install Solana CLI
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify installation
solana --version
```

#### 2. Install Anchor CLI
```bash
# Install Anchor
npm install -g @coral-xyz/anchor-cli

# Verify installation
anchor --version
```

## Part 1: GitHub Repository Setup

### 1. Initialize Git Repository
```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: PredictionPump v1.0"
```

### 2. Create GitHub Repository
1. Go to [GitHub](https://github.com) and create a new repository
2. Name it `prediction-pump` or your preferred name
3. Don't initialize with README (we already have files)
4. Copy the repository URL

### 3. Push to GitHub
```bash
# Add remote origin
git remote add origin https://github.com/YOUR_USERNAME/prediction-pump.git

# Push to main branch
git branch -M main
git push -u origin main
```

### 4. Set up GitHub Secrets (for CI/CD)
Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:
- `SOLANA_PRIVATE_KEY`: Your wallet private key (base58 encoded)
- `VERCEL_TOKEN`: Your Vercel API token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID

## Part 2: Solana Smart Contract Deployment

### 1. Configure Solana Environment
```bash
# Set cluster (devnet for testing, mainnet-beta for production)
solana config set --url devnet

# Create a new keypair (or use existing)
solana-keygen new --outfile ~/.config/solana/id.json

# Check your wallet address
solana address

# Get some SOL for deployment (devnet)
solana airdrop 2

# Check balance
solana balance
```

### 2. Configure Anchor
```bash
# Navigate to the project root
cd /path/to/prediction-pump

# Initialize Anchor workspace (if not done)
anchor init --name prediction-pump --javascript

# Update Anchor.toml
```

Create/update `Anchor.toml`:
```toml
[features]
seeds = false
skip-lint = false

[programs.devnet]
prediction_pump = "YOUR_PROGRAM_ID_HERE"

[programs.mainnet]
prediction_pump = "YOUR_PROGRAM_ID_HERE"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
```

### 3. Build and Deploy Smart Contracts
```bash
# Navigate to programs directory
cd programs

# Build the program
anchor build

# Get the program ID
solana address -k target/deploy/prediction_pump-keypair.json

# Update program ID in lib.rs and Anchor.toml
# Replace YOUR_PROGRAM_ID_HERE with the actual program ID

# Rebuild after updating program ID
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Verify deployment
solana program show YOUR_PROGRAM_ID
```

### 4. Test Smart Contracts
```bash
# Run tests
anchor test --provider.cluster devnet

# If tests pass, deploy to mainnet (when ready)
# anchor deploy --provider.cluster mainnet-beta
```

## Part 3: Vercel Frontend Deployment

### 1. Prepare Frontend for Vercel
Create `vercel.json` in the frontend directory:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "outputDirectory": ".next",
  "functions": {
    "pages/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ]
}
```

### 2. Update Environment Variables
Create `.env.local` for local development:
```bash
# Frontend environment variables
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=YOUR_DEPLOYED_PROGRAM_ID
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

### 3. Deploy to Vercel

#### Option A: Vercel CLI (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Navigate to frontend directory
cd frontend

# Deploy
vercel

# Follow the prompts:
# - Link to existing project or create new
# - Set up project settings
# - Deploy
```

#### Option B: GitHub Integration
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Configure build settings:
   - Framework Preset: Next.js
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `.next`
5. Add environment variables in Vercel dashboard

### 4. Configure Vercel Environment Variables
In Vercel Dashboard → Project → Settings → Environment Variables:

**Production Variables:**
```
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_PROGRAM_ID=YOUR_MAINNET_PROGRAM_ID
NEXT_PUBLIC_API_URL=https://your-domain.vercel.app
NEXT_PUBLIC_WS_URL=wss://your-domain.vercel.app
```

**Development Variables:**
```
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=YOUR_DEVNET_PROGRAM_ID
NEXT_PUBLIC_API_URL=https://your-domain-git-dev.vercel.app
NEXT_PUBLIC_WS_URL=wss://your-domain-git-dev.vercel.app
```

## Part 4: CI/CD Pipeline Setup

### 1. GitHub Actions for Smart Contracts
Create `.github/workflows/solana-deploy.yml`:
```yaml
name: Deploy Solana Program

on:
  push:
    branches: [main]
    paths: ['programs/**']
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install Solana CLI
        run: |
          sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"
          echo "$HOME/.local/share/solana/install/active_release/bin" >> $GITHUB_PATH
          
      - name: Install Anchor CLI
        run: npm install -g @coral-xyz/anchor-cli
        
      - name: Setup Solana Keypair
        run: |
          mkdir -p ~/.config/solana
          echo "${{ secrets.SOLANA_PRIVATE_KEY }}" > ~/.config/solana/id.json
          solana config set --keypair ~/.config/solana/id.json
          solana config set --url devnet
          
      - name: Build and Deploy
        run: |
          cd programs
          anchor build
          anchor deploy --provider.cluster devnet
          
      - name: Run Tests
        run: |
          cd programs
          anchor test --provider.cluster devnet
```

### 2. GitHub Actions for Frontend
Create `.github/workflows/vercel-deploy.yml`:
```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]
    paths: ['frontend/**']
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
          
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
          
      - name: Run tests
        run: |
          cd frontend
          npm run test:unit
          
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: frontend
          vercel-args: '--prod'
```

## Part 5: Domain and SSL Setup

### 1. Custom Domain (Optional)
1. Purchase a domain (e.g., predictionpump.com)
2. In Vercel Dashboard → Project → Settings → Domains
3. Add your custom domain
4. Update DNS records as instructed by Vercel

### 2. SSL Certificate
Vercel automatically provides SSL certificates for all domains.

## Part 6: Monitoring and Analytics

### 1. Vercel Analytics
Enable Vercel Analytics in your dashboard for performance monitoring.

### 2. Error Tracking
Add Sentry for error tracking:
```bash
cd frontend
npm install @sentry/nextjs
```

Update `next.config.js`:
```javascript
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  // your existing config
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: "your-org",
  project: "prediction-pump",
});
```

## Part 7: Testing Your Deployment

### 1. Test Smart Contracts
```bash
# Test on devnet
anchor test --provider.cluster devnet

# Verify program deployment
solana program show YOUR_PROGRAM_ID --url devnet
```

### 2. Test Frontend
1. Visit your Vercel URL
2. Test wallet connection
3. Test market interactions
4. Check browser console for errors

### 3. End-to-End Testing
```bash
cd frontend
npm run test:e2e
```

## Part 8: Production Checklist

### Before Going Live:
- [ ] Smart contracts audited
- [ ] Frontend security review
- [ ] Load testing completed
- [ ] Monitoring set up
- [ ] Backup procedures in place
- [ ] Error tracking configured
- [ ] Domain and SSL configured
- [ ] Environment variables secured
- [ ] Rate limiting implemented
- [ ] Terms of service and privacy policy added

### Mainnet Deployment:
1. Deploy contracts to mainnet-beta
2. Update frontend environment variables
3. Test thoroughly on mainnet
4. Monitor for issues
5. Set up alerts and monitoring

## Troubleshooting

### Common Issues:

#### Solana Deployment Fails
```bash
# Check balance
solana balance

# Check program size
ls -la target/deploy/

# Increase compute budget if needed
solana program deploy target/deploy/prediction_pump.so --max-len 200000
```

#### Vercel Build Fails
- Check build logs in Vercel dashboard
- Verify environment variables
- Test build locally: `npm run build`

#### Frontend Can't Connect to Program
- Verify program ID in environment variables
- Check network configuration (devnet vs mainnet)
- Verify RPC URL is accessible

### Getting Help:
- Solana Discord: https://discord.gg/solana
- Anchor Discord: https://discord.gg/anchor
- Vercel Support: https://vercel.com/help

## Next Steps

1. **Security**: Conduct security audits
2. **Performance**: Optimize for production load
3. **Features**: Add advanced features based on user feedback
4. **Marketing**: Launch marketing campaigns
5. **Community**: Build developer and user communities

This completes your deployment to GitHub, Solana, and Vercel! 🚀