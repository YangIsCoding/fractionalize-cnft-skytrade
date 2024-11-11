import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { mplBubblegum } from "@metaplex-foundation/mpl-bubblegum";
import { createNft, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import {
  generateSigner,
  keypairIdentity,
  percentAmount,
  publicKey as umiPublicKey,
  Program,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { getExplorerLink, getKeypairFromFile } from "@solana-developers/helpers";
import { clusterApiUrl } from "@solana/web3.js";

// initialize Umi and set devnet
const umi = createUmi(clusterApiUrl("devnet"));

// regiter `splToken` and `splAssociatedToken` program
const SPL_TOKEN_PROGRAM_ID = umiPublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const SPL_ASSOCIATED_TOKEN_PROGRAM_ID = umiPublicKey("ATokenGPvVvMT2z4kxywk7uwoVd5Ke1bjtU4b7Spc7A9");

// use `umi.programs.add()` to register programs manually
umi.programs.add({
  name: "splToken",
  publicKey: SPL_TOKEN_PROGRAM_ID,
  getErrorFromCode: () => null,
  getErrorFromName: () => null,
  isOnCluster: () => true,
});

umi.programs.add({
  name: "splAssociatedToken",
  publicKey: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
  getErrorFromCode: () => null,
  getErrorFromName: () => null,
  isOnCluster: () => true,
});

// use `mplTokenMetadata` and `mplBubblegum`
umi.use(mplTokenMetadata()).use(mplBubblegum()).use(dasApi());

// set local keys
const localKeypair = await getKeypairFromFile("~/.config/solana/id.json");
const umiKeypair = umi.eddsa.createKeypairFromSecretKey(localKeypair.secretKey);

// set Umi wallet id
umi.use(keypairIdentity(umiKeypair));

// generate Collection Mint
const collectionMint = generateSigner( umi );
console.log(`📢 Collection Mint Address: ${collectionMint.publicKey.toString()}`);


// build NFT Collection transaction
const transaction = createNft(umi, {
  mint: collectionMint,
  name: `My Collection`,
  uri: "https://raw.githubusercontent.com/solana-developers/professional-education/main/labs/sample-nft-collection-offchain-data.json",
  sellerFeeBasisPoints: percentAmount(0),
  isCollection: true, // mint as Collection NFT
});

// send and confirm
const result = await transaction.sendAndConfirm(umi);

console.log(
  `🖼️ 🖼️ 🖼️ built NFT Collection! see trasaction: ${getExplorerLink(
    "transaction",
    result.signature.toString(),
    "devnet"
  )}`
);
