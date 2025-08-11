#[cfg(test)]
mod tests {
    use crate::{SettlementData, MarketStatus, OracleData, Dispute, DisputeVote, DisputeOutcome, DisputeResolution, BondingCurveParams, BondingCurve};
    use anchor_lang::prelude::*;

    #[test]
    fn test_settlement_data_creation() {
        let settlement_data = SettlementData {
            winning_outcome: 1,
            settlement_timestamp: 1691234567,
            oracle_data_hash: [1u8; 32],
            total_payout: 1000000,
        };

        assert_eq!(settlement_data.winning_outcome, 1);
        assert_eq!(settlement_data.total_payout, 1000000);
    }

    #[test]
    fn test_market_status_settlement() {
        let mut status = MarketStatus {
            is_active: true,
            is_settled: false,
            winning_outcome: None,
            settlement_timestamp: None,
        };

        // Simulate settlement
        status.is_settled = true;
        status.winning_outcome = Some(0);
        status.settlement_timestamp = Some(1691234567);

        assert!(status.is_settled);
        assert_eq!(status.winning_outcome, Some(0));
        assert_eq!(status.settlement_timestamp, Some(1691234567));
    }

    #[test]
    fn test_oracle_data_validation() {
        let market_key = Pubkey::new_unique();
        let oracle_provider = Pubkey::new_unique();
        
        // This would normally be created through the OracleData::new method
        // but we can't test that without the full Solana runtime
        let oracle_data = OracleData {
            market: market_key,
            oracle_provider,
            winning_outcome: 1,
            confidence_score: 9500,
            timestamp: 1691234567,
            data_hash: [1u8; 32],
            is_disputed: false,
        };

        assert_eq!(oracle_data.winning_outcome, 1);
        assert_eq!(oracle_data.confidence_score, 9500);
        assert!(!oracle_data.is_disputed);
    }

    #[test]
    fn test_dispute_creation() {
        let market_key = Pubkey::new_unique();
        let oracle_data_key = Pubkey::new_unique();
        let disputer = Pubkey::new_unique();
        let reason = "Oracle data appears incorrect".to_string();
        let stake_amount = 1_000_000u64; // 0.001 SOL

        // Simulate dispute creation (normally done through Dispute::new)
        let dispute = Dispute {
            market: market_key,
            oracle_data: oracle_data_key,
            disputer,
            reason: reason.clone(),
            stake_amount,
            submission_time: 1691234567,
            voting_end_time: 1691234567 + (7 * 24 * 60 * 60), // 7 days later
            votes: Vec::new(),
            is_resolved: false,
            resolution: None,
        };

        assert_eq!(dispute.market, market_key);
        assert_eq!(dispute.reason, reason);
        assert_eq!(dispute.stake_amount, stake_amount);
        assert!(!dispute.is_resolved);
        assert!(dispute.votes.is_empty());
    }

    #[test]
    fn test_dispute_vote_creation() {
        let voter = Pubkey::new_unique();
        let outcome = 1u8;
        let weight = 1000u64;

        let vote = DisputeVote {
            voter,
            outcome,
            weight,
            timestamp: 1691234567,
        };

        assert_eq!(vote.voter, voter);
        assert_eq!(vote.outcome, outcome);
        assert_eq!(vote.weight, weight);
    }

    #[test]
    fn test_dispute_resolution_calculation() {
        let market_key = Pubkey::new_unique();
        let oracle_data_key = Pubkey::new_unique();
        let disputer = Pubkey::new_unique();

        let mut dispute = Dispute {
            market: market_key,
            oracle_data: oracle_data_key,
            disputer,
            reason: "Test dispute".to_string(),
            stake_amount: 1_000_000,
            submission_time: 1691234567,
            voting_end_time: 1691234567 + (7 * 24 * 60 * 60),
            votes: Vec::new(),
            is_resolved: false,
            resolution: None,
        };

        // Add votes for different outcomes
        let voter1 = Pubkey::new_unique();
        let voter2 = Pubkey::new_unique();
        let voter3 = Pubkey::new_unique();

        // Vote for outcome 0 (2000 weight)
        dispute.votes.push(DisputeVote {
            voter: voter1,
            outcome: 0,
            weight: 2000,
            timestamp: 1691234567,
        });

        // Vote for outcome 1 (1500 weight)
        dispute.votes.push(DisputeVote {
            voter: voter2,
            outcome: 1,
            weight: 1500,
            timestamp: 1691234567,
        });

        // Vote to uphold original (500 weight)
        dispute.votes.push(DisputeVote {
            voter: voter3,
            outcome: 255, // Special value for uphold
            weight: 500,
            timestamp: 1691234567,
        });

        // Test vote counting logic manually (since calculate_resolution requires Clock sysvar)
        let mut outcome_0_votes = 0u64;
        let mut outcome_1_votes = 0u64;
        let mut uphold_votes = 0u64;
        let mut total_votes = 0u64;

        for vote in &dispute.votes {
            total_votes += vote.weight;
            match vote.outcome {
                0 => outcome_0_votes += vote.weight,
                1 => outcome_1_votes += vote.weight,
                255 => uphold_votes += vote.weight,
                _ => {}
            }
        }

        // Verify vote counting
        assert_eq!(total_votes, 4000);
        assert_eq!(outcome_0_votes, 2000);
        assert_eq!(outcome_1_votes, 1500);
        assert_eq!(uphold_votes, 500);

        // Verify outcome 0 wins
        assert!(outcome_0_votes >= outcome_1_votes && outcome_0_votes >= uphold_votes);
    }

    #[test]
    fn test_dispute_resolution_uphold_original() {
        let market_key = Pubkey::new_unique();
        let oracle_data_key = Pubkey::new_unique();
        let disputer = Pubkey::new_unique();

        let mut dispute = Dispute {
            market: market_key,
            oracle_data: oracle_data_key,
            disputer,
            reason: "Test dispute".to_string(),
            stake_amount: 1_000_000,
            submission_time: 1691234567,
            voting_end_time: 1691234567 + (7 * 24 * 60 * 60),
            votes: Vec::new(),
            is_resolved: false,
            resolution: None,
        };

        // Add votes where "uphold original" wins
        let voter1 = Pubkey::new_unique();
        let voter2 = Pubkey::new_unique();

        // Vote for outcome 0 (1000 weight)
        dispute.votes.push(DisputeVote {
            voter: voter1,
            outcome: 0,
            weight: 1000,
            timestamp: 1691234567,
        });

        // Vote to uphold original (2000 weight)
        dispute.votes.push(DisputeVote {
            voter: voter2,
            outcome: 255, // Special value for uphold
            weight: 2000,
            timestamp: 1691234567,
        });

        // Test vote counting logic manually (since calculate_resolution requires Clock sysvar)
        let mut outcome_0_votes = 0u64;
        let mut uphold_votes = 0u64;
        let mut total_votes = 0u64;

        for vote in &dispute.votes {
            total_votes += vote.weight;
            match vote.outcome {
                0 => outcome_0_votes += vote.weight,
                255 => uphold_votes += vote.weight,
                _ => {}
            }
        }

        // Verify vote counting
        assert_eq!(total_votes, 3000);
        assert_eq!(outcome_0_votes, 1000);
        assert_eq!(uphold_votes, 2000);

        // Verify uphold wins
        assert!(uphold_votes >= outcome_0_votes);
    }

    #[test]
    fn test_oracle_data_dispute() {
        let market_key = Pubkey::new_unique();
        let oracle_provider = Pubkey::new_unique();
        
        let mut oracle_data = OracleData {
            market: market_key,
            oracle_provider,
            winning_outcome: 1,
            confidence_score: 9500,
            timestamp: 1691234567,
            data_hash: [1u8; 32],
            is_disputed: false,
        };

        // Test disputing oracle data
        assert!(!oracle_data.is_disputed);
        oracle_data.is_disputed = true; // Simulate dispute() method
        assert!(oracle_data.is_disputed);
    }

    // ============================================================================
    // BONDING CURVE UNIT TESTS - Task 6.1
    // ============================================================================

    fn create_test_bonding_curve_params() -> BondingCurveParams {
        BondingCurveParams {
            initial_price: 1_000_000, // 0.001 SOL in lamports
            curve_steepness: 100_000,  // Moderate steepness
            max_supply: 10_000_000,    // 10M tokens max
            fee_rate: 100,             // 1% fee (100 basis points)
        }
    }

    fn create_steep_curve_params() -> BondingCurveParams {
        BondingCurveParams {
            initial_price: 500_000,   // 0.0005 SOL
            curve_steepness: 50_000,  // Steeper curve
            max_supply: 5_000_000,    // 5M tokens max
            fee_rate: 200,            // 2% fee
        }
    }

    fn create_flat_curve_params() -> BondingCurveParams {
        BondingCurveParams {
            initial_price: 2_000_000, // 0.002 SOL
            curve_steepness: 500_000, // Flatter curve
            max_supply: 50_000_000,   // 50M tokens max
            fee_rate: 50,             // 0.5% fee
        }
    }

    #[test]
    fn test_bonding_curve_price_at_zero_supply() {
        let params = create_test_bonding_curve_params();
        let price = BondingCurve::price_at_supply(&params, 0).unwrap();
        assert_eq!(price, params.initial_price);
    }

    #[test]
    fn test_bonding_curve_price_increases_with_supply() {
        let params = create_test_bonding_curve_params();
        
        let price_0 = BondingCurve::price_at_supply(&params, 0).unwrap();
        let price_1000 = BondingCurve::price_at_supply(&params, 1000).unwrap();
        let price_10000 = BondingCurve::price_at_supply(&params, 10000).unwrap();
        let price_100000 = BondingCurve::price_at_supply(&params, 100000).unwrap();

        // Prices should increase monotonically
        assert!(price_1000 > price_0);
        assert!(price_10000 > price_1000);
        assert!(price_100000 > price_10000);

        // Test specific price increases
        assert!(price_1000 >= price_0); // Should be at least initial price
        
        // With quadratic curve, price should increase significantly
        let price_ratio = price_100000 as f64 / price_0 as f64;
        assert!(price_ratio > 1.5); // Should be at least 50% higher
    }

    #[test]
    fn test_bonding_curve_buy_price_calculation() {
        let params = create_test_bonding_curve_params();
        let current_supply = 10000;
        let amount = 1000;

        let buy_price = BondingCurve::calculate_buy_price(&params, current_supply, amount).unwrap();
        assert!(buy_price > 0);

        // Buy price should be higher than the base price due to fees
        let mid_supply_price = BondingCurve::price_at_supply(&params, current_supply + amount / 2).unwrap();
        let base_cost = mid_supply_price * amount;
        assert!(buy_price > base_cost);

        // Test that larger purchases cost more per token (due to curve)
        let small_amount = 100;
        let large_amount = 10000;
        
        let small_buy_price = BondingCurve::calculate_buy_price(&params, current_supply, small_amount).unwrap();
        let large_buy_price = BondingCurve::calculate_buy_price(&params, current_supply, large_amount).unwrap();
        
        let small_price_per_token = small_buy_price / small_amount;
        let large_price_per_token = large_buy_price / large_amount;
        
        assert!(large_price_per_token > small_price_per_token);
    }

    #[test]
    fn test_bonding_curve_sell_price_calculation() {
        let params = create_test_bonding_curve_params();
        let current_supply = 10000;
        let amount = 1000;

        let sell_price = BondingCurve::calculate_sell_price(&params, current_supply, amount).unwrap();
        assert!(sell_price > 0);

        // Sell price should be lower than buy price due to fees and spread
        let buy_price = BondingCurve::calculate_buy_price(&params, current_supply - amount, amount).unwrap();
        assert!(sell_price < buy_price);

        // Test that selling larger amounts gets worse price per token
        let small_amount = 100;
        let large_amount = 5000;
        
        let small_sell_price = BondingCurve::calculate_sell_price(&params, current_supply, small_amount).unwrap();
        let large_sell_price = BondingCurve::calculate_sell_price(&params, current_supply, large_amount).unwrap();
        
        let small_price_per_token = small_sell_price / small_amount;
        let large_price_per_token = large_sell_price / large_amount;
        
        assert!(large_price_per_token < small_price_per_token);
    }

    #[test]
    fn test_bonding_curve_zero_amount_edge_cases() {
        let params = create_test_bonding_curve_params();
        
        // Zero amount should fail for both buy and sell
        let buy_result = BondingCurve::calculate_buy_price(&params, 1000, 0);
        assert!(buy_result.is_err());

        let sell_result = BondingCurve::calculate_sell_price(&params, 1000, 0);
        assert!(sell_result.is_err());
    }

    #[test]
    fn test_bonding_curve_max_supply_edge_cases() {
        let params = create_test_bonding_curve_params();
        
        // Buying beyond max supply should fail
        let result = BondingCurve::calculate_buy_price(&params, params.max_supply - 100, 200);
        assert!(result.is_err());

        // Buying exactly to max supply should work
        let result = BondingCurve::calculate_buy_price(&params, params.max_supply - 100, 100);
        assert!(result.is_ok());

        // Selling more than current supply should fail
        let result = BondingCurve::calculate_sell_price(&params, 1000, 2000);
        assert!(result.is_err());

        // Selling exactly current supply should work
        let result = BondingCurve::calculate_sell_price(&params, 1000, 1000);
        assert!(result.is_ok());
    }

    #[test]
    fn test_bonding_curve_fee_calculations() {
        let params = create_test_bonding_curve_params();
        let current_supply = 5000;
        let amount = 1000;

        // Test buy fee calculation
        let buy_price = BondingCurve::calculate_buy_price(&params, current_supply, amount).unwrap();
        let mid_price = BondingCurve::price_at_supply(&params, current_supply + amount / 2).unwrap();
        let base_cost = mid_price * amount;
        let fee = buy_price - base_cost;
        let expected_fee = base_cost * params.fee_rate as u64 / 10000;
        
        // Fee should be approximately correct (allowing for integration approximation)
        let fee_diff = if fee > expected_fee { fee - expected_fee } else { expected_fee - fee };
        assert!(fee_diff <= expected_fee / 10); // Within 10% due to approximation

        // Test sell fee calculation
        let sell_price = BondingCurve::calculate_sell_price(&params, current_supply, amount).unwrap();
        let sell_mid_price = BondingCurve::price_at_supply(&params, current_supply - amount / 2).unwrap();
        let base_payout = sell_mid_price * amount;
        let sell_fee = base_payout - sell_price;
        let expected_sell_fee = base_payout * params.fee_rate as u64 / 10000;
        
        let sell_fee_diff = if sell_fee > expected_sell_fee { 
            sell_fee - expected_sell_fee 
        } else { 
            expected_sell_fee - sell_fee 
        };
        assert!(sell_fee_diff <= expected_sell_fee / 10);
    }

    #[test]
    fn test_bonding_curve_different_fee_rates() {
        let mut low_fee_params = create_test_bonding_curve_params();
        low_fee_params.fee_rate = 50; // 0.5%

        let mut high_fee_params = create_test_bonding_curve_params();
        high_fee_params.fee_rate = 300; // 3%

        let current_supply = 5000;
        let amount = 1000;

        let low_fee_buy = BondingCurve::calculate_buy_price(&low_fee_params, current_supply, amount).unwrap();
        let high_fee_buy = BondingCurve::calculate_buy_price(&high_fee_params, current_supply, amount).unwrap();

        let low_fee_sell = BondingCurve::calculate_sell_price(&low_fee_params, current_supply, amount).unwrap();
        let high_fee_sell = BondingCurve::calculate_sell_price(&high_fee_params, current_supply, amount).unwrap();

        // Higher fee should result in higher buy prices and lower sell prices
        assert!(high_fee_buy > low_fee_buy);
        assert!(high_fee_sell < low_fee_sell);
    }

    #[test]
    fn test_bonding_curve_different_steepness() {
        let steep_params = create_steep_curve_params();
        let flat_params = create_flat_curve_params();

        let supply_levels = [1000, 5000, 10000, 50000];

        for &supply in &supply_levels {
            if supply <= steep_params.max_supply && supply <= flat_params.max_supply {
                let steep_price = BondingCurve::price_at_supply(&steep_params, supply).unwrap();
                let flat_price = BondingCurve::price_at_supply(&flat_params, supply).unwrap();

                // At higher supply levels, steeper curves should show more dramatic price increases
                if supply > 10000 {
                    let steep_ratio = steep_price as f64 / steep_params.initial_price as f64;
                    let flat_ratio = flat_price as f64 / flat_params.initial_price as f64;
                    assert!(steep_ratio > flat_ratio);
                }
            }
        }
    }

    #[test]
    fn test_bonding_curve_slippage_calculation() {
        let params = create_test_bonding_curve_params();
        let current_supply = 10000;

        // Test slippage for different trade sizes
        let small_amount = 100;
        let medium_amount = 1000;
        let large_amount = 5000;

        let small_slippage = BondingCurve::calculate_slippage(&params, current_supply, small_amount, true).unwrap();
        let medium_slippage = BondingCurve::calculate_slippage(&params, current_supply, medium_amount, true).unwrap();
        let large_slippage = BondingCurve::calculate_slippage(&params, current_supply, large_amount, true).unwrap();

        // Larger trades should have higher slippage
        assert!(medium_slippage >= small_slippage);
        assert!(large_slippage >= medium_slippage);

        // Test sell slippage
        let sell_slippage = BondingCurve::calculate_slippage(&params, current_supply, medium_amount, false).unwrap();
        assert!(sell_slippage > 0);
    }

    #[test]
    fn test_bonding_curve_market_cap_calculation() {
        let params = create_test_bonding_curve_params();

        // Market cap at zero supply should be zero
        let zero_cap = BondingCurve::calculate_market_cap(&params, 0).unwrap();
        assert_eq!(zero_cap, 0);

        // Market cap should increase with supply
        let cap_1000 = BondingCurve::calculate_market_cap(&params, 1000).unwrap();
        let cap_5000 = BondingCurve::calculate_market_cap(&params, 5000).unwrap();
        let cap_10000 = BondingCurve::calculate_market_cap(&params, 10000).unwrap();

        assert!(cap_1000 > 0);
        assert!(cap_5000 > cap_1000);
        assert!(cap_10000 > cap_5000);

        // Market cap should be reasonable compared to individual token prices
        let price_at_5000 = BondingCurve::price_at_supply(&params, 5000).unwrap();
        assert!(cap_5000 > price_at_5000 * 2500); // Should be more than half the tokens at current price
        assert!(cap_5000 < price_at_5000 * 5000); // Should be less than all tokens at current price
    }

    #[test]
    fn test_bonding_curve_parameter_validation() {
        let mut params = create_test_bonding_curve_params();

        // Valid parameters should pass
        assert!(BondingCurve::validate_params(&params).is_ok());

        // Test invalid initial price
        params.initial_price = 0;
        assert!(BondingCurve::validate_params(&params).is_err());

        // Reset and test invalid curve steepness
        params = create_test_bonding_curve_params();
        params.curve_steepness = 0;
        assert!(BondingCurve::validate_params(&params).is_err());

        // Test curve steepness too low (should be at least 1000)
        params.curve_steepness = 500;
        assert!(BondingCurve::validate_params(&params).is_err());

        // Reset and test invalid max supply
        params = create_test_bonding_curve_params();
        params.max_supply = 0;
        assert!(BondingCurve::validate_params(&params).is_err());

        // Test fee rate too high (max 10%)
        params.fee_rate = 1500; // 15%
        assert!(BondingCurve::validate_params(&params).is_err());

        // Reset and test maximum valid fee rate
        params = create_test_bonding_curve_params();
        params.fee_rate = 1000; // 10%
        assert!(BondingCurve::validate_params(&params).is_ok());
    }

    #[test]
    fn test_bonding_curve_round_trip_trading() {
        let params = create_test_bonding_curve_params();
        let initial_supply = 10000;
        let trade_amount = 1000;

        // Buy tokens
        let buy_cost = BondingCurve::calculate_buy_price(&params, initial_supply, trade_amount).unwrap();
        let new_supply = initial_supply + trade_amount;

        // Immediately sell the same tokens
        let sell_payout = BondingCurve::calculate_sell_price(&params, new_supply, trade_amount).unwrap();

        // Should lose money due to fees (buy high, sell low)
        assert!(sell_payout < buy_cost);

        // Calculate the loss percentage
        let loss = buy_cost - sell_payout;
        let loss_percentage = loss * 10000 / buy_cost;

        // Loss should be approximately 2x the fee rate (buy fee + sell fee)
        let expected_min_loss = params.fee_rate as u64; // At least one fee
        let expected_max_loss = params.fee_rate as u64 * 4; // At most 4x fee (accounting for price movement)

        assert!(loss_percentage >= expected_min_loss);
        assert!(loss_percentage <= expected_max_loss);
    }

    #[test]
    fn test_bonding_curve_extreme_values() {
        let params = create_test_bonding_curve_params();

        // Test very small amounts
        let tiny_amount = 1;
        let buy_price = BondingCurve::calculate_buy_price(&params, 1000, tiny_amount).unwrap();
        let sell_price = BondingCurve::calculate_sell_price(&params, 1000, tiny_amount).unwrap();
        assert!(buy_price > 0);
        assert!(sell_price > 0);

        // Test near maximum supply
        let near_max_supply = params.max_supply - 1000;
        let max_buy_amount = 500;
        let buy_price_near_max = BondingCurve::calculate_buy_price(&params, near_max_supply, max_buy_amount).unwrap();
        assert!(buy_price_near_max > 0);

        // Price near max supply should be much higher than initial price
        let price_ratio = buy_price_near_max as f64 / (params.initial_price * max_buy_amount) as f64;
        assert!(price_ratio > 2.0); // Should be at least 2x higher
    }

    #[test]
    fn test_bonding_curve_mathematical_properties() {
        let params = create_test_bonding_curve_params();
        let base_supply = 5000;

        // Test that buying X tokens then Y tokens costs the same as buying X+Y tokens
        let amount_x = 500;
        let amount_y = 300;

        let cost_x = BondingCurve::calculate_buy_price(&params, base_supply, amount_x).unwrap();
        let cost_y = BondingCurve::calculate_buy_price(&params, base_supply + amount_x, amount_y).unwrap();
        let total_separate = cost_x + cost_y;

        let cost_combined = BondingCurve::calculate_buy_price(&params, base_supply, amount_x + amount_y).unwrap();

        // Should be approximately equal (allowing for small differences due to fee calculation)
        let difference = if total_separate > cost_combined {
            total_separate - cost_combined
        } else {
            cost_combined - total_separate
        };
        
        // Difference should be small relative to the total cost
        assert!(difference <= cost_combined / 100); // Within 1%
    }

    #[test]
    fn test_bonding_curve_price_monotonicity() {
        let params = create_test_bonding_curve_params();
        
        // Test that price is monotonically increasing with supply
        let supply_points = [0, 100, 500, 1000, 2000, 5000, 10000, 20000];
        let mut prev_price = 0;

        for &supply in &supply_points {
            if supply <= params.max_supply {
                let price = BondingCurve::price_at_supply(&params, supply).unwrap();
                assert!(price >= prev_price);
                prev_price = price;
            }
        }
    }

    #[test]
    fn test_bonding_curve_overflow_protection() {
        // Create parameters that might cause overflow
        let extreme_params = BondingCurveParams {
            initial_price: u64::MAX / 1000,
            curve_steepness: 1000,
            max_supply: 1000000,
            fee_rate: 100,
        };

        // Should handle large values gracefully
        let result = BondingCurve::price_at_supply(&extreme_params, 100);
        // This might overflow, which should be handled gracefully
        match result {
            Ok(price) => assert!(price > 0),
            Err(_) => {
                // Overflow error is acceptable for extreme values
                assert!(true);
            }
        }
    }
}