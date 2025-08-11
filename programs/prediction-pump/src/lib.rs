use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_lang::solana_program;

pub mod settlement;
pub use settlement::*;

pub mod bonding_curve;
pub use bonding_curve::*;

#[cfg(test)]
pub mod tests;

declare_id!("2vi9hVuYBws8GwFqPG6eRQRFoEMGfkCny2Lbvf3pFuzu");

// Constants for market configuration
pub const MINIMUM_LIQUIDITY_THRESHOLD: u64 = 1_000_000; // 0.001 SOL in lamports
pub const MINIMUM_TRADING_VOLUME: u64 = 10_000_000; // 0.01 SOL in lamports

#[program]
pub mod prediction_pump {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    /// Create a new prediction market with bonding curve pricing
    pub fn create_market(
        ctx: Context<CreateMarket>,
        description: String,
        resolution_date: i64,
        outcome_count: u8,
        initial_price: u64,
        curve_steepness: u64,
        max_supply: u64,
        fee_rate: u16,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let creator = ctx.accounts.creator.key();
        let oracle_source = ctx.accounts.oracle_source.key();

        // For now, only support binary markets (2 outcomes)
        require!(outcome_count == 2, PredictionPumpError::InsufficientOutcomes);

        // Create bonding curve parameters
        let bonding_curve_params = BondingCurveParams::new(
            initial_price,
            curve_steepness,
            max_supply,
            fee_rate,
        )?;

        // Collect outcome token mints (binary market)
        let outcome_tokens = vec![
            ctx.accounts.outcome_mint_0.key(),
            ctx.accounts.outcome_mint_1.key(),
        ];

        // Initialize market
        **market = Market::new(
            creator,
            description,
            resolution_date,
            oracle_source,
            outcome_tokens,
            bonding_curve_params,
        )?;

        Ok(())
    }

    /// Settle a market using oracle data and distribute payouts
    pub fn settle_market(ctx: Context<SettleMarket>) -> Result<()> {
        settlement::settle_market(ctx)
    }

    /// Claim payout for winning tokens
    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        settlement::claim_payout(ctx)
    }

    /// Submit a dispute for oracle data
    pub fn submit_dispute(
        ctx: Context<SubmitDispute>,
        reason: String,
        stake_amount: u64,
    ) -> Result<()> {
        let dispute = &mut ctx.accounts.dispute;
        let market = &mut ctx.accounts.market;
        let oracle_data = &mut ctx.accounts.oracle_data;
        let disputer = ctx.accounts.disputer.key();

        // Validate dispute submission
        require!(!oracle_data.is_disputed, PredictionPumpError::AlreadyDisputed);
        require!(market.status.is_settled, PredictionPumpError::MarketNotSettled);
        require!(reason.len() <= 200, PredictionPumpError::DisputeReasonTooLong);
        require!(stake_amount >= 1_000_000, PredictionPumpError::InsufficientDisputeStake); // 0.001 SOL minimum

        // Mark oracle data as disputed
        oracle_data.dispute()?;

        // Initialize dispute
        **dispute = Dispute::new(
            market.key(),
            oracle_data.key(),
            disputer,
            reason,
            stake_amount,
        )?;

        Ok(())
    }

    /// Vote on a disputed oracle outcome
    pub fn vote_on_dispute(
        ctx: Context<VoteOnDispute>,
        vote_outcome: u8,
        vote_weight: u64,
    ) -> Result<()> {
        let dispute = &mut ctx.accounts.dispute;
        let voter = ctx.accounts.voter.key();

        // Validate voting
        require!(!dispute.is_resolved, PredictionPumpError::DisputeAlreadyResolved);
        require!(dispute.voting_end_time > Clock::get()?.unix_timestamp, PredictionPumpError::VotingPeriodEnded);
        require!(vote_weight > 0, PredictionPumpError::InvalidVoteWeight);

        // Check if user already voted
        require!(!dispute.votes.iter().any(|v| v.voter == voter), PredictionPumpError::AlreadyVoted);

        // Add vote
        let vote = DisputeVote::new(voter, vote_outcome, vote_weight)?;
        dispute.add_vote(vote)?;

        Ok(())
    }

    /// Resolve a dispute after voting period ends
    pub fn resolve_dispute(ctx: Context<ResolveDispute>) -> Result<()> {
        let dispute = &mut ctx.accounts.dispute;
        let market = &mut ctx.accounts.market;
        let oracle_data = &mut ctx.accounts.oracle_data;

        // Validate resolution
        require!(!dispute.is_resolved, PredictionPumpError::DisputeAlreadyResolved);
        require!(dispute.voting_end_time <= Clock::get()?.unix_timestamp, PredictionPumpError::VotingPeriodNotEnded);

        // Calculate voting results
        let resolution = dispute.calculate_resolution()?;

        // Apply resolution
        dispute.resolve(resolution.clone())?;

        // Update market and oracle data based on resolution
        match resolution.outcome {
            DisputeOutcome::UpholdOriginal => {
                // Keep original oracle data
                oracle_data.is_disputed = false;
            }
            DisputeOutcome::OverrideOutcome(new_outcome) => {
                // Update oracle data with community decision
                oracle_data.winning_outcome = new_outcome;
                oracle_data.is_disputed = false;
                
                // Update market settlement data
                if let Some(ref mut settlement_data) = market.settlement_data {
                    settlement_data.winning_outcome = new_outcome;
                }
            }
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct SubmitDispute<'info> {
    #[account(
        init,
        payer = disputer,
        space = Dispute::LEN
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub oracle_data: Account<'info, OracleData>,

    #[account(mut)]
    pub disputer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VoteOnDispute<'info> {
    #[account(mut)]
    pub dispute: Account<'info, Dispute>,

    #[account(mut)]
    pub voter: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut)]
    pub dispute: Account<'info, Dispute>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub oracle_data: Account<'info, OracleData>,

    /// CHECK: Authority validation handled in instruction
    pub resolver: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = creator,
        space = Market::LEN
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub creator: Signer<'info>,

    /// Oracle account that will provide settlement data
    /// CHECK: Oracle validation is handled by the market logic
    pub oracle_source: UncheckedAccount<'info>,

    // Outcome token mints (required: first 2)
    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = market
    )]
    pub outcome_mint_0: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = market
    )]
    pub outcome_mint_1: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}



// Core data structures for prediction markets

#[account]
pub struct Market {
    pub creator: Pubkey,
    pub description: String,
    pub resolution_date: i64,
    pub oracle_source: Pubkey,
    pub outcome_tokens: Vec<Pubkey>,
    pub bonding_curve_params: BondingCurveParams,
    pub total_volume: u64,
    pub status: MarketStatus,
    pub settlement_data: Option<SettlementData>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct MarketStatus {
    pub is_active: bool,
    pub is_settled: bool,
    pub winning_outcome: Option<u8>,
    pub settlement_timestamp: Option<i64>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct BondingCurveParams {
    pub initial_price: u64,
    pub curve_steepness: u64,
    pub max_supply: u64,
    pub fee_rate: u16, // basis points (e.g., 100 = 1%)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct SettlementData {
    pub winning_outcome: u8,
    pub settlement_timestamp: i64,
    pub oracle_data_hash: [u8; 32],
    pub total_payout: u64,
}

// Oracle integration structures - minimal implementation for task 5.1

#[account]
pub struct OracleRegistry {
    pub authority: Pubkey,
    pub oracles: Vec<OracleProvider>,
    pub consensus_threshold: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct OracleProvider {
    pub provider_id: Pubkey,
    pub provider_type: OracleType,
    pub is_active: bool,
    pub reliability_score: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum OracleType {
    Pyth,
    Switchboard,
    Chainlink,
    Custom,
}

#[account]
pub struct OracleData {
    pub market: Pubkey,
    pub oracle_provider: Pubkey,
    pub winning_outcome: u8,
    pub confidence_score: u16,
    pub timestamp: i64,
    pub data_hash: [u8; 32],
    pub is_disputed: bool,
}

impl Market {
    pub const LEN: usize = 8 + // discriminator
        32 + // creator
        4 + 100 + // description (max 100 chars)
        8 + // resolution_date
        32 + // oracle_source
        4 + (32 * 2) + // outcome_tokens (binary only)
        BondingCurveParams::LEN + // bonding_curve_params
        8 + // total_volume
        MarketStatus::LEN + // status
        1 + SettlementData::LEN; // settlement_data (Option)

    pub fn new(
        creator: Pubkey,
        description: String,
        resolution_date: i64,
        oracle_source: Pubkey,
        outcome_tokens: Vec<Pubkey>,
        bonding_curve_params: BondingCurveParams,
    ) -> Result<Self> {
        // Validation
        require!(description.len() <= 100, PredictionPumpError::DescriptionTooLong);
        require!(outcome_tokens.len() >= 2, PredictionPumpError::InsufficientOutcomes);
        require!(outcome_tokens.len() <= 2, PredictionPumpError::TooManyOutcomes);
        require!(resolution_date > Clock::get()?.unix_timestamp, PredictionPumpError::InvalidResolutionDate);
        require!(bonding_curve_params.fee_rate <= 1000, PredictionPumpError::FeeTooHigh); // Max 10%

        Ok(Market {
            creator,
            description,
            resolution_date,
            oracle_source,
            outcome_tokens,
            bonding_curve_params,
            total_volume: 0,
            status: MarketStatus {
                is_active: false,
                is_settled: false,
                winning_outcome: None,
                settlement_timestamp: None,
            },
            settlement_data: None,
        })
    }
}

impl MarketStatus {
    pub const LEN: usize = 1 + // is_active
        1 + // is_settled
        1 + 1 + // winning_outcome (Option<u8>)
        1 + 8; // settlement_timestamp (Option<i64>)
}

impl BondingCurveParams {
    pub const LEN: usize = 8 + // initial_price
        8 + // curve_steepness
        8 + // max_supply
        2; // fee_rate

    pub fn new(initial_price: u64, curve_steepness: u64, max_supply: u64, fee_rate: u16) -> Result<Self> {
        require!(initial_price > 0, PredictionPumpError::InvalidPrice);
        require!(curve_steepness > 0, PredictionPumpError::InvalidCurveParams);
        require!(max_supply > 0, PredictionPumpError::InvalidMaxSupply);
        require!(fee_rate <= 1000, PredictionPumpError::FeeTooHigh); // Max 10%

        Ok(BondingCurveParams {
            initial_price,
            curve_steepness,
            max_supply,
            fee_rate,
        })
    }
}

impl SettlementData {
    pub const LEN: usize = 1 + // winning_outcome
        8 + // settlement_timestamp
        32 + // oracle_data_hash
        8; // total_payout
}

// Oracle implementations - minimal for task 5.1

impl OracleRegistry {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        4 + (OracleProvider::LEN * 10) + // oracles (max 10 providers)
        1; // consensus_threshold

    pub fn new(authority: Pubkey, consensus_threshold: u8) -> Result<Self> {
        require!(consensus_threshold > 0, PredictionPumpError::InvalidOracleConfig);
        require!(consensus_threshold <= 10, PredictionPumpError::InvalidOracleConfig);

        Ok(OracleRegistry {
            authority,
            oracles: Vec::new(),
            consensus_threshold,
        })
    }

    pub fn add_oracle(&mut self, oracle: OracleProvider) -> Result<()> {
        require!(self.oracles.len() < 10, PredictionPumpError::TooManyOracles);
        require!(!self.oracles.iter().any(|o| o.provider_id == oracle.provider_id), PredictionPumpError::OracleAlreadyExists);
        
        self.oracles.push(oracle);
        Ok(())
    }

    pub fn get_active_oracles(&self) -> Vec<&OracleProvider> {
        self.oracles.iter().filter(|o| o.is_active).collect()
    }

    pub fn select_fallback_oracle(&self, excluded_oracle: Pubkey) -> Option<&OracleProvider> {
        self.oracles
            .iter()
            .filter(|o| o.is_active && o.provider_id != excluded_oracle)
            .max_by_key(|o| o.reliability_score)
    }
}

impl OracleProvider {
    pub const LEN: usize = 32 + // provider_id
        1 + 1 + // provider_type (enum discriminant + data)
        1 + // is_active
        2; // reliability_score

    pub fn new(
        provider_id: Pubkey,
        provider_type: OracleType,
        reliability_score: u16,
    ) -> Result<Self> {
        require!(reliability_score <= 10000, PredictionPumpError::InvalidReliabilityScore);

        Ok(OracleProvider {
            provider_id,
            provider_type,
            is_active: true,
            reliability_score,
        })
    }

    pub fn deactivate(&mut self) -> Result<()> {
        self.is_active = false;
        Ok(())
    }
}

impl OracleData {
    pub const LEN: usize = 8 + // discriminator
        32 + // market
        32 + // oracle_provider
        1 + // winning_outcome
        2 + // confidence_score
        8 + // timestamp
        32 + // data_hash
        1; // is_disputed

    pub fn new(
        market: Pubkey,
        oracle_provider: Pubkey,
        winning_outcome: u8,
        confidence_score: u16,
    ) -> Result<Self> {
        require!(confidence_score <= 10000, PredictionPumpError::InvalidConfidenceScore);

        // Generate data hash for integrity verification
        let mut hasher = solana_program::hash::Hasher::default();
        hasher.hash(market.as_ref());
        hasher.hash(oracle_provider.as_ref());
        hasher.hash(&winning_outcome.to_le_bytes());
        hasher.hash(&confidence_score.to_le_bytes());
        let data_hash = hasher.result().to_bytes();

        Ok(OracleData {
            market,
            oracle_provider,
            winning_outcome,
            confidence_score,
            timestamp: Clock::get()?.unix_timestamp,
            data_hash,
            is_disputed: false,
        })
    }

    pub fn validate_data_integrity(&self) -> Result<bool> {
        // Recreate hash and compare
        let mut hasher = solana_program::hash::Hasher::default();
        hasher.hash(self.market.as_ref());
        hasher.hash(self.oracle_provider.as_ref());
        hasher.hash(&self.winning_outcome.to_le_bytes());
        hasher.hash(&self.confidence_score.to_le_bytes());
        let computed_hash = hasher.result().to_bytes();
        
        Ok(computed_hash == self.data_hash)
    }

    pub fn dispute(&mut self) -> Result<()> {
        require!(!self.is_disputed, PredictionPumpError::AlreadyDisputed);
        self.is_disputed = true;
        Ok(())
    }
}

// Dispute resolution structures

#[account]
pub struct Dispute {
    pub market: Pubkey,
    pub oracle_data: Pubkey,
    pub disputer: Pubkey,
    pub reason: String,
    pub stake_amount: u64,
    pub submission_time: i64,
    pub voting_end_time: i64,
    pub votes: Vec<DisputeVote>,
    pub is_resolved: bool,
    pub resolution: Option<DisputeResolution>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct DisputeVote {
    pub voter: Pubkey,
    pub outcome: u8,
    pub weight: u64,
    pub timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct DisputeResolution {
    pub outcome: DisputeOutcome,
    pub total_votes: u64,
    pub winning_votes: u64,
    pub resolution_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum DisputeOutcome {
    UpholdOriginal,
    OverrideOutcome(u8),
}

impl Dispute {
    pub const LEN: usize = 8 + // discriminator
        32 + // market
        32 + // oracle_data
        32 + // disputer
        4 + 200 + // reason (max 200 chars)
        8 + // stake_amount
        8 + // submission_time
        8 + // voting_end_time
        4 + (DisputeVote::LEN * 100) + // votes (max 100 votes)
        1 + // is_resolved
        1 + DisputeResolution::LEN; // resolution (Option)

    pub fn new(
        market: Pubkey,
        oracle_data: Pubkey,
        disputer: Pubkey,
        reason: String,
        stake_amount: u64,
    ) -> Result<Self> {
        let current_time = Clock::get()?.unix_timestamp;
        let voting_period = 7 * 24 * 60 * 60; // 7 days in seconds

        Ok(Dispute {
            market,
            oracle_data,
            disputer,
            reason,
            stake_amount,
            submission_time: current_time,
            voting_end_time: current_time + voting_period,
            votes: Vec::new(),
            is_resolved: false,
            resolution: None,
        })
    }

    pub fn add_vote(&mut self, vote: DisputeVote) -> Result<()> {
        require!(self.votes.len() < 100, PredictionPumpError::TooManyVotes);
        require!(!self.votes.iter().any(|v| v.voter == vote.voter), PredictionPumpError::AlreadyVoted);
        
        self.votes.push(vote);
        Ok(())
    }

    pub fn calculate_resolution(&self) -> Result<DisputeResolution> {
        require!(!self.votes.is_empty(), PredictionPumpError::NoVotes);

        // Count votes by outcome (simple approach for binary outcomes + uphold option)
        let mut outcome_0_votes = 0u64;
        let mut outcome_1_votes = 0u64;
        let mut uphold_votes = 0u64;
        let mut total_votes = 0u64;

        for vote in &self.votes {
            total_votes += vote.weight;
            match vote.outcome {
                0 => outcome_0_votes += vote.weight,
                1 => outcome_1_votes += vote.weight,
                255 => uphold_votes += vote.weight, // Special value for "uphold original"
                _ => {} // Ignore invalid outcomes
            }
        }

        // Find winning outcome
        let (winning_outcome, winning_votes) = if uphold_votes >= outcome_0_votes && uphold_votes >= outcome_1_votes {
            (255u8, uphold_votes)
        } else if outcome_0_votes >= outcome_1_votes {
            (0u8, outcome_0_votes)
        } else {
            (1u8, outcome_1_votes)
        };

        // Determine if original outcome should be upheld or overridden
        let outcome = if winning_outcome == 255 {
            DisputeOutcome::UpholdOriginal
        } else {
            DisputeOutcome::OverrideOutcome(winning_outcome)
        };

        Ok(DisputeResolution {
            outcome,
            total_votes,
            winning_votes,
            resolution_timestamp: Clock::get()?.unix_timestamp,
        })
    }

    pub fn resolve(&mut self, resolution: DisputeResolution) -> Result<()> {
        require!(!self.is_resolved, PredictionPumpError::DisputeAlreadyResolved);
        
        self.is_resolved = true;
        self.resolution = Some(resolution);
        Ok(())
    }
}

impl DisputeVote {
    pub const LEN: usize = 32 + // voter
        1 + // outcome
        8 + // weight
        8; // timestamp

    pub fn new(voter: Pubkey, outcome: u8, weight: u64) -> Result<Self> {
        Ok(DisputeVote {
            voter,
            outcome,
            weight,
            timestamp: Clock::get()?.unix_timestamp,
        })
    }
}

impl DisputeResolution {
    pub const LEN: usize = 1 + 1 + // outcome (enum discriminant + data)
        8 + // total_votes
        8 + // winning_votes
        8; // resolution_timestamp
}



#[error_code]
pub enum PredictionPumpError {
    #[msg("Description too long (max 100 characters)")]
    DescriptionTooLong,
    #[msg("Market must have at least 2 outcomes")]
    InsufficientOutcomes,
    #[msg("Market cannot have more than 2 outcomes")]
    TooManyOutcomes,
    #[msg("Resolution date must be in the future")]
    InvalidResolutionDate,
    #[msg("Fee rate cannot exceed 10%")]
    FeeTooHigh,
    #[msg("Invalid price (must be greater than 0)")]
    InvalidPrice,
    #[msg("Invalid bonding curve parameters")]
    InvalidCurveParams,
    #[msg("Invalid maximum supply")]
    InvalidMaxSupply,
    #[msg("Invalid oracle configuration")]
    InvalidOracleConfig,
    #[msg("Too many oracles (max 10)")]
    TooManyOracles,
    #[msg("Oracle already exists")]
    OracleAlreadyExists,
    #[msg("Invalid reliability score (must be 0-10000)")]
    InvalidReliabilityScore,
    #[msg("Invalid confidence score (must be 0-10000)")]
    InvalidConfidenceScore,
    #[msg("Already disputed")]
    AlreadyDisputed,
    // Settlement-related errors
    #[msg("Market has already been settled")]
    MarketAlreadySettled,
    #[msg("Market resolution date has not yet passed")]
    MarketNotYetResolved,
    #[msg("Invalid oracle data for this market")]
    InvalidOracleData,
    #[msg("Unauthorized oracle provider")]
    UnauthorizedOracle,
    #[msg("Oracle data is disputed and cannot be used for settlement")]
    DisputedOracleData,
    #[msg("Oracle data integrity check failed")]
    CorruptedOracleData,
    #[msg("Invalid winning outcome index")]
    InvalidWinningOutcome,
    #[msg("Market has not been settled yet")]
    MarketNotSettled,
    #[msg("No winning outcome determined")]
    NoWinningOutcome,
    #[msg("User does not hold winning tokens")]
    NotWinningTokens,
    #[msg("No tokens to redeem")]
    NoTokensToRedeem,
    #[msg("No settlement data available")]
    NoSettlementData,
    #[msg("No winning token supply available")]
    NoWinningTokenSupply,
    #[msg("Mathematical overflow occurred")]
    MathOverflow,
    #[msg("No payout available for user")]
    NoPayoutAvailable,
    #[msg("Insufficient funds in market vault")]
    InsufficientVaultFunds,
    #[msg("Unauthorized token account")]
    UnauthorizedTokenAccount,
    // Dispute resolution errors
    #[msg("Dispute reason too long (max 200 characters)")]
    DisputeReasonTooLong,
    #[msg("Insufficient dispute stake (minimum 0.001 SOL)")]
    InsufficientDisputeStake,
    #[msg("Dispute already resolved")]
    DisputeAlreadyResolved,
    #[msg("Voting period has ended")]
    VotingPeriodEnded,
    #[msg("Voting period has not ended yet")]
    VotingPeriodNotEnded,
    #[msg("Invalid vote weight")]
    InvalidVoteWeight,
    #[msg("User has already voted on this dispute")]
    AlreadyVoted,
    #[msg("Too many votes (max 100)")]
    TooManyVotes,
    #[msg("No votes submitted for dispute")]
    NoVotes,
}