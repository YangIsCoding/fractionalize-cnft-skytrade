import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { mplBubblegum } from "@metaplex-foundation/mpl-bubblegum";
import {
  keypairIdentity,
  publicKey as UMIPublicKey,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { getKeypairFromFile } from "@solana-developers/helpers";

const umi = createUmi(
  "https://devnet.helius-rpc.com/?api-key=ceecb347-4f2f-4b68-a263-8b59babc8e5d"
);

// load keypair from local file system
// See https://github.com/solana-developers/helpers?tab=readme-ov-file#get-a-keypair-from-a-keypair-file
const localKeypair = await getKeypairFromFile("~/.config/solana/id.json");

// convert to Umi compatible keypair
const umiKeypair = umi.eddsa.createKeypairFromSecretKey(localKeypair.secretKey);

// load the MPL Bubblegum program, dasApi plugin and assign a signer to our umi instance
umi.use(keypairIdentity(umiKeypair)).use(mplBubblegum()).use(dasApi());

const assetId = UMIPublicKey("JAiQXwzU12MrQXdkxbV9r3Jh2kLAK3HYnARQ5cJtZQaB");

// @ts-ignore
const rpcAsset = await umi.rpc.getAsset(assetId);
console.log(rpcAsset);
