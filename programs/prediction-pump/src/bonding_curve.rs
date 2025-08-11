use anchor_lang::prelude::*;
use crate::{BondingCurveParams, PredictionPumpError};

/// Bonding curve implementation for dynamic token pricing
pub struct BondingCurve;

impl BondingCurve {
    /// Calculate the price to buy a specific amount of tokens
    /// Uses the formula: price = initial_price * (1 + current_supply / curve_steepness)^2
    pub fn calculate_buy_price(
        params: &BondingCurveParams,
        current_supply: u64,
        amount: u64,
    ) -> Result<u64> {
        require!(amount > 0, PredictionPumpError::InvalidPrice);
        require!(current_supply + amount <= params.max_supply, PredictionPumpError::InvalidMaxSupply);

        // Calculate average price over the range [current_supply, current_supply + amount]
        let start_price = Self::price_at_supply(params, current_supply)?;
        let end_price = Self::price_at_supply(params, current_supply + amount)?;
        
        // Use trapezoidal rule for integration approximation
        let average_price = (start_price + end_price) / 2;
        let total_cost = average_price.checked_mul(amount)
            .ok_or(PredictionPumpError::MathOverflow)?;

        // Add trading fee
        let fee = total_cost.checked_mul(params.fee_rate as u64)
            .ok_or(PredictionPumpError::MathOverflow)?
            .checked_div(10000)
            .ok_or(PredictionPumpError::MathOverflow)?;

        total_cost.checked_add(fee)
            .ok_or(PredictionPumpError::MathOverflow.into())
    }

    /// Calculate the payout for selling a specific amount of tokens
    /// Uses the same curve but in reverse, with a small spread to prevent arbitrage
    pub fn calculate_sell_price(
        params: &BondingCurveParams,
        current_supply: u64,
        amount: u64,
    ) -> Result<u64> {
        require!(amount > 0, PredictionPumpError::InvalidPrice);
        require!(amount <= current_supply, PredictionPumpError::InvalidMaxSupply);

        // Calculate average price over the range [current_supply - amount, current_supply]
        let start_price = Self::price_at_supply(params, current_supply.saturating_sub(amount))?;
        let end_price = Self::price_at_supply(params, current_supply)?;
        
        // Use trapezoidal rule for integration approximation
        let average_price = (start_price + end_price) / 2;
        let total_payout = average_price.checked_mul(amount)
            .ok_or(PredictionPumpError::MathOverflow)?;

        // Subtract trading fee
        let fee = total_payout.checked_mul(params.fee_rate as u64)
            .ok_or(PredictionPumpError::MathOverflow)?
            .checked_div(10000)
            .ok_or(PredictionPumpError::MathOverflow)?;

        total_payout.checked_sub(fee)
            .ok_or(PredictionPumpError::MathOverflow.into())
    }

    /// Calculate the price at a specific supply level
    /// Formula: price = initial_price * (1 + supply / curve_steepness)^2
    pub fn price_at_supply(params: &BondingCurveParams, supply: u64) -> Result<u64> {
        if supply == 0 {
            return Ok(params.initial_price);
        }

        // Calculate (1 + supply / curve_steepness)
        // Using fixed-point arithmetic to avoid floating point
        let supply_ratio = supply.checked_mul(10000)
            .ok_or(PredictionPumpError::MathOverflow)?
            .checked_div(params.curve_steepness)
            .ok_or(PredictionPumpError::MathOverflow)?;
        
        let multiplier = 10000u64.checked_add(supply_ratio)
            .ok_or(PredictionPumpError::MathOverflow)?;

        // Square the multiplier: (1 + supply / curve_steepness)^2
        let multiplier_squared = multiplier.checked_mul(multiplier)
            .ok_or(PredictionPumpError::MathOverflow)?
            .checked_div(10000)
            .ok_or(PredictionPumpError::MathOverflow)?;

        // Apply to initial price
        params.initial_price.checked_mul(multiplier_squared)
            .ok_or(PredictionPumpError::MathOverflow)?
            .checked_div(10000)
            .ok_or(PredictionPumpError::MathOverflow.into())
    }

    /// Calculate slippage for a trade
    /// Returns the percentage difference between expected and actual price
    pub fn calculate_slippage(
        params: &BondingCurveParams,
        current_supply: u64,
        amount: u64,
        is_buy: bool,
    ) -> Result<u16> {
        let current_price = Self::price_at_supply(params, current_supply)?;
        
        let actual_price = if is_buy {
            Self::calculate_buy_price(params, current_supply, amount)?
                .checked_div(amount)
                .ok_or(PredictionPumpError::MathOverflow)?
        } else {
            Self::calculate_sell_price(params, current_supply, amount)?
                .checked_div(amount)
                .ok_or(PredictionPumpError::MathOverflow)?
        };

        if actual_price >= current_price {
            let slippage = actual_price.checked_sub(current_price)
                .ok_or(PredictionPumpError::MathOverflow)?
                .checked_mul(10000)
                .ok_or(PredictionPumpError::MathOverflow)?
                .checked_div(current_price)
                .ok_or(PredictionPumpError::MathOverflow)?;
            
            Ok(slippage as u16)
        } else {
            let slippage = current_price.checked_sub(actual_price)
                .ok_or(PredictionPumpError::MathOverflow)?
                .checked_mul(10000)
                .ok_or(PredictionPumpError::MathOverflow)?
                .checked_div(current_price)
                .ok_or(PredictionPumpError::MathOverflow)?;
            
            Ok(slippage as u16)
        }
    }

    /// Validate bonding curve parameters
    pub fn validate_params(params: &BondingCurveParams) -> Result<()> {
        require!(params.initial_price > 0, PredictionPumpError::InvalidPrice);
        require!(params.curve_steepness > 0, PredictionPumpError::InvalidCurveParams);
        require!(params.max_supply > 0, PredictionPumpError::InvalidMaxSupply);
        require!(params.fee_rate <= 1000, PredictionPumpError::FeeTooHigh); // Max 10%
        
        // Ensure curve steepness is reasonable to prevent overflow
        require!(params.curve_steepness >= 1000, PredictionPumpError::InvalidCurveParams);
        
        Ok(())
    }

    /// Calculate the total market cap at a given supply level
    pub fn calculate_market_cap(params: &BondingCurveParams, supply: u64) -> Result<u64> {
        if supply == 0 {
            return Ok(0);
        }

        // Integrate the price function from 0 to supply
        // For our quadratic curve, this is: initial_price * supply * (1 + supply / (2 * curve_steepness))
        let supply_factor = supply.checked_mul(10000)
            .ok_or(PredictionPumpError::MathOverflow)?
            .checked_div(2 * params.curve_steepness)
            .ok_or(PredictionPumpError::MathOverflow)?;
        
        let multiplier = 10000u64.checked_add(supply_factor)
            .ok_or(PredictionPumpError::MathOverflow)?;

        params.initial_price.checked_mul(supply)
            .ok_or(PredictionPumpError::MathOverflow)?
            .checked_mul(multiplier)
            .ok_or(PredictionPumpError::MathOverflow)?
            .checked_div(10000)
            .ok_or(PredictionPumpError::MathOverflow.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_params() -> BondingCurveParams {
        BondingCurveParams {
            initial_price: 1000, // 0.001 SOL in lamports
            curve_steepness: 10000, // Moderate steepness
            max_supply: 1_000_000, // 1M tokens max
            fee_rate: 100, // 1% fee
        }
    }

    #[test]
    fn test_price_at_zero_supply() {
        let params = create_test_params();
        let price = BondingCurve::price_at_supply(&params, 0).unwrap();
        assert_eq!(price, params.initial_price);
    }

    #[test]
    fn test_price_increases_with_supply() {
        let params = create_test_params();
        let price_0 = BondingCurve::price_at_supply(&params, 0).unwrap();
        let price_1000 = BondingCurve::price_at_supply(&params, 1000).unwrap();
        let price_5000 = BondingCurve::price_at_supply(&params, 5000).unwrap();

        assert!(price_1000 > price_0);
        assert!(price_5000 > price_1000);
    }

    #[test]
    fn test_buy_price_calculation() {
        let params = create_test_params();
        let current_supply = 1000;
        let amount = 100;

        let buy_price = BondingCurve::calculate_buy_price(&params, current_supply, amount).unwrap();
        assert!(buy_price > 0);

        // Price should include fee
        let base_price = BondingCurve::price_at_supply(&params, current_supply + amount / 2).unwrap() * amount;
        assert!(buy_price > base_price);
    }

    #[test]
    fn test_sell_price_calculation() {
        let params = create_test_params();
        let current_supply = 1000;
        let amount = 100;

        let sell_price = BondingCurve::calculate_sell_price(&params, current_supply, amount).unwrap();
        assert!(sell_price > 0);

        // Sell price should be less than buy price due to fees and spread
        let buy_price = BondingCurve::calculate_buy_price(&params, current_supply - amount, amount).unwrap();
        assert!(sell_price < buy_price);
    }

    #[test]
    fn test_zero_amount_fails() {
        let params = create_test_params();
        let result = BondingCurve::calculate_buy_price(&params, 1000, 0);
        assert!(result.is_err());

        let result = BondingCurve::calculate_sell_price(&params, 1000, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_exceeds_max_supply_fails() {
        let params = create_test_params();
        let result = BondingCurve::calculate_buy_price(&params, params.max_supply - 10, 20);
        assert!(result.is_err());
    }

    #[test]
    fn test_sell_more_than_supply_fails() {
        let params = create_test_params();
        let result = BondingCurve::calculate_sell_price(&params, 100, 200);
        assert!(result.is_err());
    }

    #[test]
    fn test_slippage_calculation() {
        let params = create_test_params();
        let current_supply = 1000;
        let small_amount = 10;
        let large_amount = 1000;

        let small_slippage = BondingCurve::calculate_slippage(&params, current_supply, small_amount, true).unwrap();
        let large_slippage = BondingCurve::calculate_slippage(&params, current_supply, large_amount, true).unwrap();

        // Larger trades should have higher slippage
        assert!(large_slippage > small_slippage);
    }

    #[test]
    fn test_market_cap_calculation() {
        let params = create_test_params();
        let supply = 1000;

        let market_cap = BondingCurve::calculate_market_cap(&params, supply).unwrap();
        assert!(market_cap > 0);

        // Market cap should increase with supply
        let larger_market_cap = BondingCurve::calculate_market_cap(&params, supply * 2).unwrap();
        assert!(larger_market_cap > market_cap);
    }

    #[test]
    fn test_validate_params() {
        let mut params = create_test_params();
        assert!(BondingCurve::validate_params(&params).is_ok());

        // Test invalid initial price
        params.initial_price = 0;
        assert!(BondingCurve::validate_params(&params).is_err());

        // Reset and test invalid curve steepness
        params = create_test_params();
        params.curve_steepness = 0;
        assert!(BondingCurve::validate_params(&params).is_err());

        // Test curve steepness too low
        params.curve_steepness = 500;
        assert!(BondingCurve::validate_params(&params).is_err());

        // Reset and test invalid max supply
        params = create_test_params();
        params.max_supply = 0;
        assert!(BondingCurve::validate_params(&params).is_err());

        // Test fee rate too high
        params.fee_rate = 1500; // 15%
        assert!(BondingCurve::validate_params(&params).is_err());
    }

    #[test]
    fn test_fee_calculation_accuracy() {
        let params = create_test_params();
        let current_supply = 1000;
        let amount = 100;

        let buy_price = BondingCurve::calculate_buy_price(&params, current_supply, amount).unwrap();
        
        // Calculate expected fee
        let base_price = BondingCurve::price_at_supply(&params, current_supply + amount / 2).unwrap() * amount;
        let expected_fee = base_price * params.fee_rate as u64 / 10000;
        let expected_total = base_price + expected_fee;

        // Allow for small rounding differences
        let difference = if buy_price > expected_total {
            buy_price - expected_total
        } else {
            expected_total - buy_price
        };
        
        // Should be within 1% of expected (accounting for integration approximation)
        assert!(difference <= expected_total / 100);
    }

    #[test]
    fn test_price_continuity() {
        let params = create_test_params();
        
        // Test that buying and immediately selling results in a loss due to fees
        let current_supply = 1000;
        let amount = 100;

        let buy_cost = BondingCurve::calculate_buy_price(&params, current_supply, amount).unwrap();
        let sell_payout = BondingCurve::calculate_sell_price(&params, current_supply + amount, amount).unwrap();

        // Should lose money due to fees (buy high, sell low)
        assert!(sell_payout < buy_cost);
        
        // The loss should be approximately 2x the fee rate (buy fee + sell fee)
        let loss_percentage = (buy_cost - sell_payout) * 10000 / buy_cost;
        let expected_loss = 2 * params.fee_rate as u64; // Approximate expected loss
        
        // Allow for some variance due to price movement and integration approximation
        assert!(loss_percentage >= expected_loss / 2);
        assert!(loss_percentage <= expected_loss * 3);
    }
}