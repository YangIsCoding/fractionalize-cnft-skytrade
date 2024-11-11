import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FractionalizeCnft } from "../target/types/fractionalize_cnft";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint,
} from "@solana/spl-token";
import { assert } from "chai";
import fs from 'fs';
import os from 'os';

describe("fractionalize-cnft", function () {
  this.timeout(100000); // Set timeout to 100 seconds

  // Load existing wallet Keypair
  const KEYPAIR_PATH = os.homedir() + '/.config/solana/id.json';
  const payerKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8')))
  );

  // Set up Anchor Provider with existing wallet
  const connection = new anchor.web3.Connection("https://api.devnet.solana.com", 'confirmed');
  const wallet = new anchor.Wallet(payerKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const program = anchor.workspace.FractionalizeCnft as Program<FractionalizeCnft>;

  // Accounts
  let nftMint: PublicKey;
  let nftTokenAccount: PublicKey;
  let fractionMint: PublicKey;
  let userFractionAccount: PublicKey;
  let vaultNftAccount: PublicKey;
  let fractionMintAuthority: Keypair;
  let vaultAuthority: Keypair;

  const fractionAmount = new anchor.BN(1000);

  it("Initialize accounts", async function () {
    try {
      // Check payer's balance
      const balance = await connection.getBalance(payerKeypair.publicKey);
      console.log("Payer balance:", balance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
      if (balance < anchor.web3.LAMPORTS_PER_SOL) {
        console.warn("Payer has less than 1 SOL, please airdrop manually.");
      }

      // Create NFT Mint
      nftMint = await createMint(
        connection,
        payerKeypair,
        payerKeypair.publicKey,
        null,
        0
      );
      console.log("NFT Mint:", nftMint.toBase58());

      // Create user's NFT account and mint 1 NFT
      nftTokenAccount = await createAssociatedTokenAccount(
        connection,
        payerKeypair,
        nftMint,
        payerKeypair.publicKey
      );
      console.log("User NFT Account:", nftTokenAccount.toBase58());

      await mintTo(
        connection,
        payerKeypair,
        nftMint,
        nftTokenAccount,
        payerKeypair,
        1
      );
      console.log("Minted 1 NFT to user's account.");

      // Create fractional token Mint
      fractionMintAuthority = Keypair.generate();
      fractionMint = await createMint(
        connection,
        payerKeypair,
        fractionMintAuthority.publicKey,
        null,
        0
      );
      console.log("Fraction Mint:", fractionMint.toBase58());

      // Create user's fractional token account
      userFractionAccount = await createAssociatedTokenAccount(
        connection,
        payerKeypair,
        fractionMint,
        payerKeypair.publicKey
      );
      console.log("User Fraction Account:", userFractionAccount.toBase58());

      // Create vault NFT account
      vaultAuthority = Keypair.generate();
      vaultNftAccount = await createAssociatedTokenAccount(
        connection,
        payerKeypair,
        nftMint,
        vaultAuthority.publicKey
      );
      console.log("Vault NFT Account:", vaultNftAccount.toBase58());
    } catch (error) {
      console.error("Error during account initialization:", error);
      throw error;
    }
  });

  it("Lock NFT and mint fractions", async function () {
    try {
      // Call lock_nft_and_mint_fractions method
      const tx = await program.methods
        .lockNftAndMintFractions(fractionAmount)
        .accounts({
          user: payerKeypair.publicKey,
          userNftAccount: nftTokenAccount,
          vaultNftAccount: vaultNftAccount,
          fractionMint: fractionMint,
          userFractionAccount: userFractionAccount,
          fractionMintAuthority: fractionMintAuthority.publicKey,
        })
        .signers([fractionMintAuthority])
        .rpc();

      console.log("Transaction signature", tx);

      // Verify NFT has been transferred to vault
      const vaultNftAccountInfo = await getAccount(
        connection,
        vaultNftAccount
      );
      assert.strictEqual(Number(vaultNftAccountInfo.amount), 1);

      // Verify user's NFT account balance is 0
      const userNftAccountInfo = await getAccount(
        connection,
        nftTokenAccount
      );
      assert.strictEqual(Number(userNftAccountInfo.amount), 0);

      // Verify user's fractional token account balance
      const userFractionAccountInfo = await getAccount(
        connection,
        userFractionAccount
      );
      assert.strictEqual(
        Number(userFractionAccountInfo.amount),
        fractionAmount.toNumber()
      );
    } catch (error) {
      console.error("Error during Lock NFT and mint fractions:", error);
      throw error;
    }
  });

  it("Redeem fractions and unlock NFT", async function () {
    try {
      // Call redeem_fractions_and_unlock_nft method
      const tx = await program.methods
        .redeemFractionsAndUnlockNft()
        .accounts({
          user: payerKeypair.publicKey,
          userFractionAccount: userFractionAccount,
          fractionMint: fractionMint,
          userNftAccount: nftTokenAccount,
          vaultNftAccount: vaultNftAccount,
          vaultAuthority: vaultAuthority.publicKey,
        })
        .signers([vaultAuthority])
        .rpc();

      console.log("Transaction signature", tx);

      // Verify NFT has been returned to user
      const userNftAccountInfo = await getAccount(
        connection,
        nftTokenAccount
      );
      assert.strictEqual(Number(userNftAccountInfo.amount), 1);

      // Verify vault NFT account balance is 0
      const vaultNftAccountInfo = await getAccount(
        connection,
        vaultNftAccount
      );
      assert.strictEqual(Number(vaultNftAccountInfo.amount), 0);

      // Verify user's fractional token account balance is 0
      const userFractionAccountInfo = await getAccount(
        connection,
        userFractionAccount
      );
      assert.strictEqual(Number(userFractionAccountInfo.amount), 0);

      // Verify total supply of fractional tokens is 0
      const fractionMintInfo = await getMint(
        connection,
        fractionMint
      );
      assert.strictEqual(Number(fractionMintInfo.supply), 0);
    } catch (error) {
      console.error("Error during Redeem fractions and unlock NFT:", error);
      throw error;
    }
  });
});
