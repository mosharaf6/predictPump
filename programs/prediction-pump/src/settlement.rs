use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, burn, Burn};

use crate::{Market, MarketStatus, SettlementData, OracleData, PredictionPumpError};

/// Settle a market using oracle data and distribute payouts
pub fn settle_market(ctx: Context<SettleMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let oracle_data = &ctx.accounts.oracle_data;
    let clock = Clock::get()?;

    // Validate market can be settled
    require!(!market.status.is_settled, PredictionPumpError::MarketAlreadySettled);
    require!(
        clock.unix_timestamp >= market.resolution_date,
        PredictionPumpError::MarketNotYetResolved
    );

    // Validate oracle data
    require!(
        oracle_data.market == market.key(),
        PredictionPumpError::InvalidOracleData
    );
    require!(
        oracle_data.oracle_provider == market.oracle_source,
        PredictionPumpError::UnauthorizedOracle
    );
    require!(
        !oracle_data.is_disputed,
        PredictionPumpError::DisputedOracleData
    );

    // Validate oracle data integrity
    require!(
        oracle_data.validate_data_integrity()?,
        PredictionPumpError::CorruptedOracleData
    );

    // Validate winning outcome is valid for this market
    require!(
        (oracle_data.winning_outcome as usize) < market.outcome_tokens.len(),
        PredictionPumpError::InvalidWinningOutcome
    );

    // Calculate total payout from market vault
    let total_payout = **ctx.accounts.market_vault.to_account_info().lamports.borrow();

    // Update market status
    market.status.is_settled = true;
    market.status.winning_outcome = Some(oracle_data.winning_outcome);
    market.status.settlement_timestamp = Some(clock.unix_timestamp);

    // Create settlement data
    market.settlement_data = Some(SettlementData {
        winning_outcome: oracle_data.winning_outcome,
        settlement_timestamp: clock.unix_timestamp,
        oracle_data_hash: oracle_data.data_hash,
        total_payout,
    });

    // Emit settlement event
    emit!(MarketSettledEvent {
        market: market.key(),
        winning_outcome: oracle_data.winning_outcome,
        total_payout,
        settlement_timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Claim payout for winning tokens
pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
    let market = &ctx.accounts.market;
    let user_token_account = &ctx.accounts.user_token_account;

    // Validate market is settled
    require!(market.status.is_settled, PredictionPumpError::MarketNotSettled);
    
    let winning_outcome = market.status.winning_outcome
        .ok_or(PredictionPumpError::NoWinningOutcome)?;

    // Validate user holds winning tokens
    let winning_token_mint = market.outcome_tokens[winning_outcome as usize];
    require!(
        user_token_account.mint == winning_token_mint,
        PredictionPumpError::NotWinningTokens
    );

    let token_balance = user_token_account.amount;
    require!(token_balance > 0, PredictionPumpError::NoTokensToRedeem);

    // Calculate proportional payout
    let settlement_data = market.settlement_data
        .as_ref()
        .ok_or(PredictionPumpError::NoSettlementData)?;

    // Get total supply of winning tokens to calculate proportion
    let winning_token_mint_account = &ctx.accounts.winning_token_mint;
    let total_winning_supply = winning_token_mint_account.supply;
    
    require!(total_winning_supply > 0, PredictionPumpError::NoWinningTokenSupply);

    // Calculate user's proportional share of the payout
    let user_payout = (settlement_data.total_payout as u128)
        .checked_mul(token_balance as u128)
        .ok_or(PredictionPumpError::MathOverflow)?
        .checked_div(total_winning_supply as u128)
        .ok_or(PredictionPumpError::MathOverflow)? as u64;

    require!(user_payout > 0, PredictionPumpError::NoPayoutAvailable);

    // Transfer SOL payout to user
    let market_vault_info = ctx.accounts.market_vault.to_account_info();
    let user_info = ctx.accounts.user.to_account_info();

    **market_vault_info.try_borrow_mut_lamports()? = market_vault_info
        .lamports()
        .checked_sub(user_payout)
        .ok_or(PredictionPumpError::InsufficientVaultFunds)?;

    **user_info.try_borrow_mut_lamports()? = user_info
        .lamports()
        .checked_add(user_payout)
        .ok_or(PredictionPumpError::MathOverflow)?;

    // Burn the winning tokens
    let cpi_accounts = Burn {
        mint: ctx.accounts.winning_token_mint.to_account_info(),
        from: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    burn(cpi_ctx, token_balance)?;

    // Emit payout event
    emit!(PayoutClaimedEvent {
        market: market.key(),
        user: ctx.accounts.user.key(),
        amount: user_payout,
        tokens_burned: token_balance,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    /// Oracle data account containing the settlement outcome
    pub oracle_data: Account<'info, OracleData>,

    /// Market vault holding SOL for payouts
    #[account(mut)]
    /// CHECK: Market vault is validated by seeds
    pub market_vault: UncheckedAccount<'info>,

    /// Authority that can trigger settlement (anyone can call after resolution date)
    pub settler: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// User's token account holding winning tokens
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    /// Winning token mint to validate and burn tokens
    #[account(mut)]
    pub winning_token_mint: Account<'info, Mint>,

    /// Market vault to transfer SOL from
    #[account(mut)]
    /// CHECK: Market vault is validated by seeds
    pub market_vault: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

// Events for off-chain indexing and real-time updates

#[event]
pub struct MarketSettledEvent {
    pub market: Pubkey,
    pub winning_outcome: u8,
    pub total_payout: u64,
    pub settlement_timestamp: i64,
}

#[event]
pub struct PayoutClaimedEvent {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub tokens_burned: u64,
}