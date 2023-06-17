import * as Web3 from '@solana/web3.js';
import * as fs from 'fs';
import dotenv from 'dotenv';
import { transfer } from '@solana/spl-token';
dotenv.config();

const PROGRAM_ID = new Web3.PublicKey("ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa")
const PROGRAM_DATA_PUBLIC_KEY = new Web3.PublicKey("Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod")
const RECEIVER_PUBLIC_KEY = new Web3.PublicKey("CCoSKkgPWC1CSBki4LM9cCp9hM9zURQyfgY6h3UtNitR")

// Step 1: generate a new keypair
async function initializeKeypair(connection: Web3.Connection): Promise<Web3.Keypair>{
    if (!process.env.PRIVATE_KEY){
        console.log('Generating new keypair ... 🗝️')
        const signer = Web3.Keypair.generate();

        console.log('Creating .env file');
        fs.writeFileSync('.env', `PRIVATE_KEY=[${signer.secretKey.toString()}]`);
        return signer;
    }
    const secret = JSON.parse(process.env.PRIVATE_KEY ?? '') as number[];
    const secretKey = Uint8Array.from(secret);
    const keypairFromSecret = Web3.Keypair.fromSecretKey(secretKey);
    return keypairFromSecret;
}
// Step 2: airdrop some SOL
async function airdropSolIfNeeded(
    signer: Web3.Keypair,
    connection: Web3.Connection
){
    const balance = await connection.getBalance(signer.publicKey);
    console.log('Current balance is ', balance/Web3.LAMPORTS_PER_SOL,'SOL')
    // 1 SOL should be enough for almost anything you wanna to do
    if (balance / Web3.LAMPORTS_PER_SOL < 1){
        // You can get up to 2 SOL per request
        console.log('Airdropping 1 SOL');
        const airdropSignature = await connection.requestAirdrop(
            signer.publicKey,
            Web3.LAMPORTS_PER_SOL
        );

        const latestBlockhash = await connection.getLatestBlockhash();

        await connection.confirmTransaction({
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            signature: airdropSignature,
        });

        const newBalance = await connection.getBalance(signer.publicKey);
        console.log('New balance is',newBalance/Web3.LAMPORTS_PER_SOL,' SOL')
    }
}
// Step 3: interact with a Program
async function pingProgram(connection: Web3.Connection, payer: Web3.Keypair) {
    const transaction = new Web3.Transaction()
    const instruction = new Web3. TransactionInstruction({
        // Instruction need 3 things
        // 1. The public keys of all the accounts the instruction will read/write
        keys: [
            {
                pubkey: PROGRAM_DATA_PUBLIC_KEY,
                isSigner: false,
                isWritable: true,
            }
        ],
        // 2. The ID of the program this instruction will be sent to
        programId: PROGRAM_ID,
        // 3. Data - in this case, there's none
    })
    transaction.add(instruction)
    const transactionSignature = await Web3.sendAndConfirmTransaction(connection,transaction,[payer])
    console.log(
        `Transaction https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}
// Step 4: interact with a System Program
async function sendSOL(connection: Web3.Connection, payer: Web3.Keypair) {
    // if account balance < 0.15 SOL then stop
    const balance = await connection.getBalance(payer.publicKey);
    if (balance / Web3.LAMPORTS_PER_SOL < 0.15) {
        console.log("Balance is not enough")
        return;
    }
    const transaction = new Web3.Transaction();
    // send 0.1 SOL to the RECEIVER_PUBLIC_KEY
    const instruction = Web3.SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: RECEIVER_PUBLIC_KEY,
        lamports: 0.1*Web3.LAMPORTS_PER_SOL,
    });
    transaction.add(instruction)
    const transactionSignature = await Web3.sendAndConfirmTransaction(connection, transaction, [payer])
    console.log(`0.1 SOL sent to ${RECEIVER_PUBLIC_KEY}`)
    console.log(
        `Transaction https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}

async function main() {
    // Step 0: build a connection to the devnet
    const connection = new Web3.Connection(Web3.clusterApiUrl('devnet'));
    // Step 1: generate a new keypair
    const signer = await initializeKeypair(connection);
    console.log("Public key: ",signer.publicKey.toBase58())
    // Step 2: airdrop some SOL
    await airdropSolIfNeeded(signer, connection);
    // Step 3: interact with a Program
    await pingProgram(connection, signer);
    // Step 4: interact with a System Program
    await sendSOL(connection, signer)
}

main()
    .then(() => {
        console.log("Finished successfully")
        process.exit(0)
    })
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })
