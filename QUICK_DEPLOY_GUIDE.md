# Quick Deployment Guide 🚀

Follow these steps to deploy PredictionPump to GitHub, Solana, and Vercel.

## Step 1: GitHub Setup (5 minutes)

### 1.1 Create GitHub Repository
```bash
# Initialize git and commit
git init
git add .
git commit -m "Initial commit: PredictionPump v1.0"

# Create repository on GitHub.com, then:
git remote add origin https://github.com/YOUR_USERNAME/prediction-pump.git
git branch -M main
git push -u origin main
```

### 1.2 Add GitHub Secrets
Go to: Repository → Settings → Secrets and variables → Actions

Add these secrets:
- `SOLANA_PRIVATE_KEY`: Your wallet private key (get with: `cat ~/.config/solana/id.json`)
- `VERCEL_TOKEN`: Get from [Vercel Settings](https://vercel.com/account/tokens)
- `VERCEL_ORG_ID`: Get from Vercel project settings
- `VERCEL_PROJECT_ID`: Get from Vercel project settings

## Step 2: Solana Setup (10 minutes)

### 2.1 Install Tools
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Install Anchor CLI
npm install -g @coral-xyz/anchor-cli

# Verify installations
solana --version
anchor --version
```

### 2.2 Setup Wallet
```bash
# Create new keypair (or use existing)
solana-keygen new --outfile ~/.config/solana/id.json

# Set to devnet
solana config set --url devnet

# Get some SOL
solana airdrop 2

# Check balance
solana balance
```

### 2.3 Deploy Smart Contract
```bash
# Build the program
anchor build

# Get program ID
solana address -k target/deploy/prediction_pump-keypair.json

# Update the program ID in:
# - programs/prediction-pump/src/lib.rs (declare_id! macro)
# - Anchor.toml (all program entries)

# Rebuild with correct program ID
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Test the deployment
anchor test --provider.cluster devnet
```

## Step 3: Vercel Setup (5 minutes)

### 3.1 Install Vercel CLI
```bash
npm install -g vercel
vercel login
```

### 3.2 Deploy Frontend
```bash
cd frontend

# Copy environment file
cp .env.local.example .env.local

# Edit .env.local with your program ID:
# NEXT_PUBLIC_PROGRAM_ID=YOUR_DEPLOYED_PROGRAM_ID

# Deploy to Vercel
vercel

# Follow prompts to create new project
```

### 3.3 Configure Environment Variables
In Vercel Dashboard → Project → Settings → Environment Variables:

**Production:**
```
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=YOUR_PROGRAM_ID
NEXT_PUBLIC_API_URL=https://your-app.vercel.app
NEXT_PUBLIC_WS_URL=wss://your-app.vercel.app
```

## Step 4: Test Everything (5 minutes)

### 4.1 Test Smart Contract
```bash
# Verify program is deployed
solana program show YOUR_PROGRAM_ID --url devnet

# Check on Solana Explorer
# https://explorer.solana.com/address/YOUR_PROGRAM_ID?cluster=devnet
```

### 4.2 Test Frontend
1. Visit your Vercel URL
2. Try connecting a wallet (use Phantom or Solflare)
3. Test basic functionality
4. Check browser console for errors

## Step 5: Set Up Automatic Deployments

The GitHub Actions workflows are already configured! They will:
- Deploy Solana contracts when you push changes to `programs/`
- Deploy frontend to Vercel when you push changes to `frontend/`

## Common Issues & Solutions

### Issue: "Program ID mismatch"
**Solution:** Make sure the program ID in `lib.rs` matches the one in `Anchor.toml`

### Issue: "Insufficient funds"
**Solution:** Get more SOL: `solana airdrop 2`

### Issue: "Vercel build fails"
**Solution:** Check environment variables are set correctly in Vercel dashboard

### Issue: "Frontend can't connect to program"
**Solution:** Verify `NEXT_PUBLIC_PROGRAM_ID` matches your deployed program

## Next Steps

### For Production (Mainnet):
1. **Audit**: Get smart contracts audited
2. **Test**: Thoroughly test on devnet first
3. **Deploy**: Deploy to mainnet-beta
4. **Monitor**: Set up monitoring and alerts

### For Development:
1. **Features**: Add more prediction markets
2. **UI/UX**: Improve user interface
3. **Performance**: Optimize for speed
4. **Security**: Add rate limiting and validation

## Useful Commands

```bash
# Check Solana config
solana config get

# Check program logs
solana logs YOUR_PROGRAM_ID

# Redeploy frontend
cd frontend && vercel --prod

# Check Vercel deployments
vercel ls

# View Vercel logs
vercel logs
```

## Support

- **Solana**: [Discord](https://discord.gg/solana) | [Docs](https://docs.solana.com)
- **Anchor**: [Discord](https://discord.gg/anchor) | [Docs](https://www.anchor-lang.com)
- **Vercel**: [Support](https://vercel.com/help) | [Docs](https://vercel.com/docs)

## Estimated Total Time: 25 minutes

That's it! Your PredictionPump is now live on:
- 📱 **Frontend**: Your Vercel URL
- ⛓️ **Smart Contract**: Solana devnet
- 💾 **Code**: GitHub repository

Happy building! 🎉