import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { mplBubblegum, mintToCollectionV1, findLeafAssetIdPda } from "@metaplex-foundation/mpl-bubblegum";
import { createNft, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import {
  generateSigner,
  keypairIdentity,
  publicKey as umiPublicKey,
  percentAmount,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { getKeypairFromFile, getExplorerLink } from "@solana-developers/helpers";
import { clusterApiUrl, PublicKey } from "@solana/web3.js";

// initialize Umi and set devnet
const umi = createUmi(clusterApiUrl("devnet")).use(mplTokenMetadata()).use(mplBubblegum()).use(dasApi());

// load local keys
const localKeypair = await getKeypairFromFile("~/.config/solana/id.json");
const umiKeypair = umi.eddsa.createKeypairFromSecretKey(localKeypair.secretKey);
umi.use(keypairIdentity(umiKeypair));

// Collection Mint and Merkle Tree address
const collectionMint = umiPublicKey("H8699kKjxs3dEn8ESathDRTwKZPAraZtwM7TumWPpVAB");
const merkleTreeAddress = umiPublicKey("2aT56mvXdiUzPCsBmukV9LBJDAYw1zc8B1iGfKYig5sk");

console.log(`📢 using Collection Mint: ${collectionMint.toString()}`);
console.log(`📢 using Merkle Tree address: ${merkleTreeAddress.toString()}`);

// mint Compressed NFT to Collection
const transaction = await mintToCollectionV1(umi, {
  leafOwner: umi.identity.publicKey,
  merkleTree: merkleTreeAddress,
  collectionMint: collectionMint,
  metadata: {
    name: "My Compressed NFT",
    uri: "https://example.com/my-compressed-nft.json",
    sellerFeeBasisPoints: 0,
    collection: { key: collectionMint, verified: true },
    creators: [
      {
        address: umi.identity.publicKey,
        verified: true,
        share: 100,
      },
    ],
  },
}).sendAndConfirm(umi);

console.log(
  `🖼️ built Compressed NFT! see transaction: ${getExplorerLink(
    "transaction",
    transaction.signature.toString(),
    "devnet"
  )}`
);

// use `findLeafAssetIdPda` to collect Asset ID
const leafIndex = 0;
const assetId = findLeafAssetIdPda(umi, {
  merkleTree: merkleTreeAddress,
  leafIndex,
})[0];

console.log(`🔑 Asset ID: ${assetId.toString()}`);
