import axios from 'axios';
import { WALLET_ADDRESSES } from '@/config/wallets';
import { NFT, CollectionGroup } from './types';

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const BASE_URL = 'https://api.opensea.io/api/v2';

interface AssetEvent {
  event_type: string;
  nft: NFT;
  from_address: string;
  [key: string]: unknown;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAllMintEvents(wallet: string) {
  let allMints: AssetEvent[] = [];
  let next = '';
  let count = 0;
  const MAX_PAGES = 5;

  console.log(`Fetching mint events for ${wallet}...`);

  try {
    do {
      const url = `${BASE_URL}/events/accounts/${wallet}`;
      const params: Record<string, string | number> = {
        event_type: 'transfer',
        limit: 50,
      };
      if (next) params.next = next;

      const response = await axios.get(url, {
        headers: {
          'x-api-key': OPENSEA_API_KEY,
          'accept': 'application/json'
        },
        params
      });

      const events: AssetEvent[] = response.data.asset_events || [];

      const mints = events.filter((e) =>
        e.from_address === '0x0000000000000000000000000000000000000000' && e.nft
      );

      allMints = [...allMints, ...mints];
      next = response.data.next;
      count++;

      await sleep(200);

    } while (next && count < MAX_PAGES);
  } catch (error) {
    console.error(`Error fetching events for ${wallet}:`, error);
  }

  console.log(`Found ${allMints.length} mint events for ${wallet}`);
  return allMints;
}

async function fetchOwnedNFTs(wallet: string) {
  let allNFTs: NFT[] = [];
  let next = '';
  const MAX_PAGES = 5;
  let count = 0;

  console.log(`Fetching owned NFTs for ${wallet}...`);

  try {
    do {
      const url = `${BASE_URL}/chain/ethereum/account/${wallet}/nfts`;
      const params: Record<string, string | number> = { limit: 50 };
      if (next) params.next = next;

      const response = await axios.get(url, {
        headers: {
          'x-api-key': OPENSEA_API_KEY,
          'accept': 'application/json'
        },
        params
      });

      const nfts: NFT[] = response.data.nfts || [];
      allNFTs = [...allNFTs, ...nfts];
      next = response.data.next;
      count++;
      await sleep(200);

    } while (next && count < MAX_PAGES);
  } catch (error) {
    console.error(`Error fetching owned NFTs for ${wallet}:`, error);
  }

  console.log(`Found ${allNFTs.length} owned NFTs for ${wallet}`);
  return allNFTs;
}

async function fetchListingsForContract(contract: string, tokenIds: string[]): Promise<Record<string, NFT['price']>> {
  const priceMap: Record<string, NFT['price']> = {};

  // API limitation: might need to batch if too many token IDs.
  // OpenSea doc doesn't specify max, but 30 is safe.
  const BATCH_SIZE = 30;

  for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + BATCH_SIZE);

    // Construct query params: ?asset_contract_address=...&token_ids=...&token_ids=...
    const params = new URLSearchParams();
    params.append('asset_contract_address', contract);
    batch.forEach(id => params.append('token_ids', id));

    const url = `${BASE_URL}/orders/ethereum/seaport/listings?${params.toString()}`;

    try {
      const response = await axios.get(url, {
        headers: {
          'x-api-key': OPENSEA_API_KEY,
          'accept': 'application/json'
        }
      });

      const orders = response.data.orders || [];

      // Process orders to find best price per token
      orders.forEach((order: any) => {
         // Check if order is active listing (ask)
         if (order.side !== 'ask' || order.cancelled || order.finalized) return;

         const makerAsset = order.maker_asset_bundle?.assets?.[0];
         if (!makerAsset) return;

         const tokenId = makerAsset.token_id;
         const currentPriceWei = BigInt(order.current_price);

         // Basic decimals handling (assuming ETH/WETH usually 18)
         const decimals = 18;
         const currentPriceEth = Number(currentPriceWei) / (10 ** decimals);

         // We want the lowest price
         if (!priceMap[tokenId] || currentPriceEth < priceMap[tokenId]!.amount) {
           priceMap[tokenId] = {
             amount: currentPriceEth,
             currency: 'ETH', // Simplification, could be WETH etc.
             decimals: decimals,
             raw: order.current_price
           };
         }
      });

      // Removed sleep here; controlling rate at batch level

    } catch (error) {
      console.error(`Error fetching listings for contract ${contract}:`, error);
    }
  }

  return priceMap;
}

export async function getBardIonsonArt(): Promise<Record<string, CollectionGroup>> {
  const envWallets = process.env.NEXT_PUBLIC_WALLET_ADDRESSES ? process.env.NEXT_PUBLIC_WALLET_ADDRESSES.split(',') : [];
  const wallets = envWallets.length > 0 ? envWallets : WALLET_ADDRESSES;

  const allNFTs: NFT[] = [];
  const seenIds = new Set<string>();

  // 1. Gather all unique NFTs
  for (const wallet of wallets) {
    if (!wallet) continue;

    const mintEvents = await fetchAllMintEvents(wallet.trim());
    const mintedNFTs = mintEvents.map((e) => e.nft).filter((n) => n);
    const ownedNFTs = await fetchOwnedNFTs(wallet.trim());
    const combined = [...mintedNFTs, ...ownedNFTs];

    for (const nft of combined) {
        const uniqueId = `${nft.contract}-${nft.identifier}`;
        if (!seenIds.has(uniqueId)) {
            const finalNFT: NFT = {
                ...nft,
                image_url: nft.display_image_url || nft.image_url,
                price: null
            };

            if (finalNFT.image_url) {
                allNFTs.push(finalNFT);
                seenIds.add(uniqueId);
            }
        }
    }
  }

  // 2. Fetch Prices (Group by Contract)
  const contractMap: Record<string, string[]> = {};
  allNFTs.forEach(nft => {
    if (!contractMap[nft.contract]) {
      contractMap[nft.contract] = [];
    }
    contractMap[nft.contract].push(nft.identifier);
  });

  // Iterate contracts and fetch listings in batches
  const BATCH_SIZE_CONTRACTS = 5;
  const contractEntries = Object.entries(contractMap);

  for (let i = 0; i < contractEntries.length; i += BATCH_SIZE_CONTRACTS) {
    const batch = contractEntries.slice(i, i + BATCH_SIZE_CONTRACTS);

    await Promise.all(batch.map(async ([contract, tokenIds]) => {
      console.log(`Fetching listings for contract ${contract} (${tokenIds.length} items)...`);
      try {
        const prices = await fetchListingsForContract(contract, tokenIds);
        // Assign prices back to NFTs
        allNFTs.forEach(nft => {
          if (nft.contract === contract && prices[nft.identifier]) {
            nft.price = prices[nft.identifier];
          }
        });
      } catch (err) {
        console.error(`Failed to fetch listings for contract ${contract}`, err);
      }
    }));

    // Add delay between batches to avoid rate limits
    if (i + BATCH_SIZE_CONTRACTS < contractEntries.length) {
      await sleep(1000);
    }
  }

  // 3. Group by Collection
  const grouped: Record<string, CollectionGroup> = {};

  allNFTs.forEach(nft => {
      const slug = nft.collection;
      if (!grouped[slug]) {
          grouped[slug] = {
              name: slug,
              slug: slug,
              nfts: []
          };
      }
      grouped[slug].nfts.push(nft);
  });

  return grouped;
}
