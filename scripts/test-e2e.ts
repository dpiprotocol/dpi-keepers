/**
 * E2E test: create 2 test wallets, fund them, deposit USDC collateral,
 * place opposing orders (long vs short), and verify the filler bot matches them.
 */
import {
	Connection,
	Keypair,
	PublicKey,
	LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { Wallet } from '@drift-labs/sdk';
import {
	DriftClient,
	initialize,
	BN,
	OrderType,
	OrderParams,
	PositionDirection,
	MarketType,
	QUOTE_PRECISION,
	BASE_PRECISION,
	TokenFaucet,
} from '@drift-labs/sdk';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';

const PROGRAM_ID = 'LYQNV5cgGq8rCRAxFk9QDc2kQ3dDMWoPdcrx4vsSGuw';
const RPC_URL = 'https://api.devnet.solana.com';
const USDC_MINT = new PublicKey('8zGuJQqwhZafTah7Uc7Z4tXRnguqkn5KLFAP8oV6PHe2');
const TOKEN_FAUCET_PROGRAM_ID = new PublicKey('V4v1mQiAdLz4qwckEb45WqHYceYizoib39cDBHSWfaB');
const KEYPAIR_DIR = path.resolve(__dirname, '../test-wallets');

const PERP_MARKET_INDEX = 0;
const DEPOSIT_AMOUNT_USDC = 1000; // $1000 USDC each
const ORDER_SIZE_BASE = 0.1; // 0.1 units

function loadOrCreateKeypair(name: string): Keypair {
	const filepath = path.join(KEYPAIR_DIR, `${name}.json`);
	if (fs.existsSync(filepath)) {
		const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
		return Keypair.fromSecretKey(Uint8Array.from(data));
	}
	const kp = Keypair.generate();
	fs.writeFileSync(filepath, JSON.stringify(Array.from(kp.secretKey)));
	console.log(`Generated new keypair for ${name}: ${kp.publicKey.toBase58()}`);
	return kp;
}

async function airdropSol(
	connection: Connection,
	pubkey: PublicKey,
	amount: number
) {
	const balance = await connection.getBalance(pubkey);
	if (balance >= amount * LAMPORTS_PER_SOL) {
		console.log(
			`  ${pubkey.toBase58().slice(0, 8)}... already has ${(balance / LAMPORTS_PER_SOL).toFixed(2)} SOL`
		);
		return;
	}
	console.log(`  Airdropping ${amount} SOL to ${pubkey.toBase58().slice(0, 8)}...`);
	const sig = await connection.requestAirdrop(
		pubkey,
		amount * LAMPORTS_PER_SOL
	);
	await connection.confirmTransaction(sig, 'confirmed');
	console.log(`  Airdrop confirmed: ${sig.slice(0, 20)}...`);
}

async function mintDevnetUsdc(
	connection: Connection,
	wallet: Wallet,
	amount: number
) {
	const ata = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
	const faucet = new TokenFaucet(
		connection,
		wallet,
		TOKEN_FAUCET_PROGRAM_ID,
		USDC_MINT,
		{ commitment: 'confirmed' }
	);
	const mintAmount = new BN(amount).mul(QUOTE_PRECISION);
	console.log(`  Minting ${amount} USDC to ${wallet.publicKey.toBase58().slice(0, 8)}...`);
	const sig = await faucet.mintToUser(ata, mintAmount);
	console.log(`  Mint tx: ${sig.slice(0, 20)}...`);
}

async function createDriftClient(
	connection: Connection,
	wallet: Wallet
): Promise<DriftClient> {
	const client = new DriftClient({
		connection,
		wallet,
		programID: new PublicKey(PROGRAM_ID),
		opts: { commitment: 'confirmed', preflightCommitment: 'confirmed' },
		activeSubAccountId: 0,
		accountSubscription: { type: 'websocket' },
		env: 'devnet',
	});
	await client.subscribe();
	return client;
}

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
	console.log('=== DPI E2E Test ===\n');

	const connection = new Connection(RPC_URL, 'confirmed');

	// Initialize SDK
	initialize({
		env: 'devnet',
		overrideEnv: { DRIFT_PROGRAM_ID: PROGRAM_ID },
	});

	// Step 1: Load/create test wallets
	console.log('Step 1: Loading test wallets...');
	const traderA = loadOrCreateKeypair('test-trader-a');
	const traderB = loadOrCreateKeypair('test-trader-b');
	console.log(`  Trader A (LONG):  ${traderA.publicKey.toBase58()}`);
	console.log(`  Trader B (SHORT): ${traderB.publicKey.toBase58()}`);

	// Step 2: Fund with SOL
	console.log('\nStep 2: Funding SOL...');
	await airdropSol(connection, traderA.publicKey, 2);
	await sleep(1000);
	await airdropSol(connection, traderB.publicKey, 2);

	// Step 3: Mint devnet USDC
	console.log('\nStep 3: Minting devnet USDC...');
	const walletA = new Wallet(traderA);
	const walletB = new Wallet(traderB);
	await mintDevnetUsdc(connection, walletA, DEPOSIT_AMOUNT_USDC);
	await sleep(1000);
	await mintDevnetUsdc(connection, walletB, DEPOSIT_AMOUNT_USDC);

	// Step 4: Create DriftClients and initialize user accounts
	console.log('\nStep 4: Initializing protocol user accounts...');
	const clientA = await createDriftClient(connection, walletA);
	const clientB = await createDriftClient(connection, walletB);

	for (const [name, client] of [
		['A', clientA],
		['B', clientB],
	] as const) {
		if (!(await client.getUser().exists())) {
			console.log(`  Creating user account for Trader ${name}...`);
			const [txSig] = await client.initializeUserAccount();
			console.log(`  Init tx: ${txSig.slice(0, 20)}...`);
		} else {
			console.log(`  Trader ${name} user account already exists.`);
		}
	}

	// Step 5: Deposit USDC collateral
	console.log('\nStep 5: Depositing USDC collateral...');
	const depositAmount = new BN(DEPOSIT_AMOUNT_USDC).mul(QUOTE_PRECISION);

	for (const [name, client, wallet] of [
		['A', clientA, walletA],
		['B', clientB, walletB],
	] as const) {
		const ata = await getAssociatedTokenAddress(
			USDC_MINT,
			wallet.publicKey
		);
		console.log(`  Depositing ${DEPOSIT_AMOUNT_USDC} USDC for Trader ${name}...`);
		const txSig = await client.deposit(depositAmount, 0, ata);
		console.log(`  Deposit tx: ${txSig.slice(0, 20)}...`);
	}

	await sleep(2000);

	// Step 6: Place opposing orders
	console.log('\nStep 6: Placing opposing orders...');
	const orderSize = new BN(ORDER_SIZE_BASE * BASE_PRECISION.toNumber());

	// Trader A: LONG market order
	console.log(`  Trader A placing LONG market order (${ORDER_SIZE_BASE} units)...`);
	const longOrderParams: OrderParams = {
		orderType: OrderType.MARKET,
		marketType: MarketType.PERP,
		marketIndex: PERP_MARKET_INDEX,
		direction: PositionDirection.LONG,
		baseAssetAmount: orderSize,
	};
	const longTx = await clientA.placePerpOrder(longOrderParams);
	console.log(`  Long order tx: ${longTx.slice(0, 20)}...`);

	await sleep(2000);

	// Trader B: SHORT market order
	console.log(`  Trader B placing SHORT market order (${ORDER_SIZE_BASE} units)...`);
	const shortOrderParams: OrderParams = {
		orderType: OrderType.MARKET,
		marketType: MarketType.PERP,
		marketIndex: PERP_MARKET_INDEX,
		direction: PositionDirection.SHORT,
		baseAssetAmount: orderSize,
	};
	const shortTx = await clientB.placePerpOrder(shortOrderParams);
	console.log(`  Short order tx: ${shortTx.slice(0, 20)}...`);

	// Step 7: Wait for filler bot and check positions
	console.log('\nStep 7: Waiting for filler bot to match orders...');
	for (let i = 0; i < 30; i++) {
		await sleep(2000);
		await clientA.getUser().fetchAccounts();
		await clientB.getUser().fetchAccounts();

		const posA = clientA.getUser().getPerpPosition(PERP_MARKET_INDEX);
		const posB = clientB.getUser().getPerpPosition(PERP_MARKET_INDEX);

		const filledA =
			posA && !posA.baseAssetAmount.isZero();
		const filledB =
			posB && !posB.baseAssetAmount.isZero();

		if (filledA || filledB) {
			console.log(`\n  FILLED after ~${(i + 1) * 2}s!`);
			if (posA) {
				console.log(
					`  Trader A position: ${posA.baseAssetAmount.toString()} base (${posA.baseAssetAmount.isNeg() ? 'SHORT' : 'LONG'})`
				);
			}
			if (posB) {
				console.log(
					`  Trader B position: ${posB.baseAssetAmount.toString()} base (${posB.baseAssetAmount.isNeg() ? 'SHORT' : 'LONG'})`
				);
			}
			break;
		}

		// Check open orders
		const ordersA = clientA.getUser().getOpenOrders();
		const ordersB = clientB.getUser().getOpenOrders();
		process.stdout.write(
			`  [${(i + 1) * 2}s] Orders: A=${ordersA.length} B=${ordersB.length} | Positions: A=${posA?.baseAssetAmount?.toString() ?? 'none'} B=${posB?.baseAssetAmount?.toString() ?? 'none'}\r`
		);

		if (i === 29) {
			console.log('\n  Timeout — orders not filled within 60s.');
			console.log('  Open orders A:', ordersA.length);
			console.log('  Open orders B:', ordersB.length);
		}
	}

	// Final state
	console.log('\n=== Final State ===');
	await clientA.getUser().fetchAccounts();
	await clientB.getUser().fetchAccounts();

	for (const [name, client] of [
		['A', clientA],
		['B', clientB],
	] as const) {
		const freeCollateral = client.getUser().getFreeCollateral();
		const orders = client.getUser().getOpenOrders();
		const pos = client.getUser().getPerpPosition(PERP_MARKET_INDEX);
		console.log(`Trader ${name}:`);
		console.log(`  Free collateral: $${freeCollateral.div(QUOTE_PRECISION).toString()}`);
		console.log(`  Open orders: ${orders.length}`);
		console.log(
			`  Perp position: ${pos ? pos.baseAssetAmount.toString() + ' base' : 'none'}`
		);
	}

	await clientA.unsubscribe();
	await clientB.unsubscribe();
	console.log('\nDone!');
}

main().catch((err) => {
	console.error('E2E test failed:', err);
	process.exit(1);
});
