use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use spl_token::state::{Account as SplAccount, Mint as SplMint};
use anchor_lang::solana_program::program_pack::Pack;

declare_id!("J8tMVQ4K8LNth8XvJoQ9g5jPJinebH1MnQvcbrAGHozP");

#[program]
pub mod fractionalize_cnft {
    use super::*;

    pub fn lock_nft_and_mint_fractions(
        ctx: Context<LockNftAndMintFractions>,
        fraction_amount: u64,
    ) -> Result<()> {
        // Get AccountInfo
        let user_nft_account_info = &ctx.accounts.user_nft_account.to_account_info();
        let vault_nft_account_info = &ctx.accounts.vault_nft_account.to_account_info();
        let fraction_mint_info = &ctx.accounts.fraction_mint.to_account_info();
        let user_fraction_account_info = &ctx.accounts.user_fraction_account.to_account_info();

        let user_nft_account = SplAccount::unpack(&user_nft_account_info.data.borrow())?;
        // Check account owner
        require_keys_eq!(
            user_nft_account.owner,
            ctx.accounts.user.key(),
            CustomError::InvalidOwner
        );

        // Transfer NFT to vault
        let cpi_accounts = anchor_spl::token::Transfer {
            from: user_nft_account_info.clone(),
            to: vault_nft_account_info.clone(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        anchor_spl::token::transfer(CpiContext::new(cpi_program, cpi_accounts), 1)?;

        // Mint fractional tokens to user
        let cpi_accounts = anchor_spl::token::MintTo {
            mint: fraction_mint_info.clone(),
            to: user_fraction_account_info.clone(),
            authority: ctx.accounts.fraction_mint_authority.to_account_info(),
        };
        anchor_spl::token::mint_to(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            fraction_amount,
        )?;

        Ok(())
    }

    pub fn redeem_fractions_and_unlock_nft(
        ctx: Context<RedeemFractionsAndUnlockNft>,
    ) -> Result<()> {
        // Get AccountInfo
        let user_fraction_account_info = &ctx.accounts.user_fraction_account.to_account_info();
        let fraction_mint_info = &ctx.accounts.fraction_mint.to_account_info();
        let user_nft_account_info = &ctx.accounts.user_nft_account.to_account_info();
        let vault_nft_account_info = &ctx.accounts.vault_nft_account.to_account_info();

        // Deserialize accounts
        let user_fraction_account = SplAccount::unpack(&user_fraction_account_info.data.borrow())?;
        let fraction_mint = SplMint::unpack(&fraction_mint_info.data.borrow())?;

        // Confirm user holds all fractional tokens
        require!(
            user_fraction_account.amount == fraction_mint.supply,
            CustomError::InsufficientFractionTokens
        );

        // Burn fractional tokens
        let cpi_accounts = anchor_spl::token::Burn {
            mint: fraction_mint_info.clone(),
            from: user_fraction_account_info.clone(),
            authority: ctx.accounts.user.to_account_info(),
        };
        anchor_spl::token::burn(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            user_fraction_account.amount,
        )?;

        // Transfer NFT back from vault to user
        let cpi_accounts = anchor_spl::token::Transfer {
            from: vault_nft_account_info.clone(),
            to: user_nft_account_info.clone(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        anchor_spl::token::transfer(CpiContext::new(cpi_program, cpi_accounts), 1)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct LockNftAndMintFractions<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    ///   verified `user_nft_account` 
    #[account(mut)]
    pub user_nft_account: UncheckedAccount<'info>,

    ///   verified `vault_nft_account` 
    #[account(mut)]
    pub vault_nft_account: UncheckedAccount<'info>,

    ///   verified `fraction_mint` 
    #[account(mut)]
    pub fraction_mint: UncheckedAccount<'info>,

    ///   verified `user_fraction_account` 
    #[account(mut)]
    pub user_fraction_account: UncheckedAccount<'info>,

    pub fraction_mint_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RedeemFractionsAndUnlockNft<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    ///   verified `user_fraction_account` 
    #[account(mut)]
    pub user_fraction_account: UncheckedAccount<'info>,

    ///   verified `fraction_mint` 
    #[account(mut)]
    pub fraction_mint: UncheckedAccount<'info>,

    ///   verified `user_nft_account`
    #[account(mut)]
    pub user_nft_account: UncheckedAccount<'info>,

    ///   verified `vault_nft_account` 
    #[account(mut)]
    pub vault_nft_account: UncheckedAccount<'info>,

    pub vault_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum CustomError {
    #[msg("Insufficient fraction tokens to redeem the NFT.")]
    InsufficientFractionTokens,
    #[msg("Invalid owner for token account.")]
    InvalidOwner,
}
