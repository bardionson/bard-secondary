
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { NFT, CollectionGroup } from '@/lib/types';
import { TARGETS } from '@/config/targets';
import { WALLET_ADDRESSES } from '@/config/wallets';

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const BASE_URL = 'https://api.opensea.io/api/v2';

// SuperRare contracts provided by user
const SUPERRARE_CONTRACTS = [
  '0xb932a70A57673d89f4acfFBE830E8ed7f75Fb9e0', // V2
  '0x41A322b28D0fF354040e2CbC676F0320d8c8850d'  // V1
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ... fetchCollectionNFTs and fetchSingleNFT (keep existing logic) ...
// Copying existing helper functions to ensure the file is complete.

async function fetchCollectionNFTs(slug: string) {
  let allNFTs: NFT[] = [];
  let next = '';
  const MAX_PAGES = 5;
  let count = 0;

  console.log(`Fetching collection: ${slug}...`);

  try {
    do {
      const url = `${BASE_URL}/collection/${slug}/nfts`;
      const params: Record<string, string | number> = { limit: 50 };
      if (next) params.next = next;

      const response = await axios.get(url, {
        headers: {
          'x-api-key': OPENSEA_API_KEY,
          'accept': 'application/json'
        },
        params
      });

      const nfts = (response.data.nfts || []).map((item: any) => ({
        identifier: item.identifier,
        collection: slug,
        contract: item.contract,
        token_standard: item.token_standard,
        name: item.name,
        description: item.description,
        image_url: item.image_url,
        display_image_url: item.display_image_url,
        opensea_url: item.opensea_url,
        updated_at: item.updated_at,
        price: null
      }));

      allNFTs = [...allNFTs, ...nfts];
      next = response.data.next;
      count++;
      await sleep(200);

    } while (next && count < MAX_PAGES);
  } catch (error: any) {
    console.error(`Error fetching collection ${slug}:`, error?.message || String(error));
  }

  console.log(`Found ${allNFTs.length} NFTs in ${slug}`);
  return allNFTs;
}

async function fetchSingleNFT(chain: string, contract: string, tokenId: string) {
  const url = `${BASE_URL}/chain/${chain}/contract/${contract}/nfts/${tokenId}`;
  try {
    const response = await axios.get(url, {
      headers: { 'x-api-key': OPENSEA_API_KEY, 'accept': 'application/json' }
    });
    const nft = response.data.nft;
    if (nft) {
       return [{
        identifier: nft.identifier,
        collection: nft.collection,
        contract: nft.contract,
        token_standard: nft.token_standard,
        name: nft.name,
        description: nft.description,
        image_url: nft.image_url,
        display_image_url: nft.display_image_url,
        opensea_url: nft.opensea_url,
        updated_at: nft.updated_at,
        price: null
      }];
    }
  } catch (error: any) {
    console.error(`Error fetching single NFT ${contract}/${tokenId}:`, error?.message || String(error));
  }
  return [];
}

// New: Fetch all NFTs from a contract and filter by creator (from metadata or traits if available, or just generic ownership if that was the only way, but v2 has 'creator' field in some responses? No, OpenSea v2 NFT object doesn't always have creator address at top level easily.)
// Actually, `GET /chain/{chain}/contract/{address}/nfts` returns all.
// We need to filter.
// Challenge: OpenSea NFT object has `creators` list?
// Let's inspect the object structure from previous logs.
// It has `creator: ""` in one log.
// We will try to fetch and filter.

async function fetchContractAndFilter(contract: string) {
    let allNFTs: NFT[] = [];
    let next = '';
    const MAX_PAGES = 10;
    let count = 0;

    // Normalize wallets
    const creators = WALLET_ADDRESSES.map(w => w.toLowerCase());

    console.log(`Fetching contract ${contract} and filtering for creators...`);

    try {
        do {
            const url = `${BASE_URL}/chain/ethereum/contract/${contract}/nfts`;
            const params: Record<string, string | number> = { limit: 50 };
            if (next) params.next = next;

            const response = await axios.get(url, {
                headers: { 'x-api-key': OPENSEA_API_KEY, 'accept': 'application/json' },
                params
            });

            const rawNFTs = response.data.nfts || [];

            // Filter logic:
            // 1. Check if we can find creator in the response.
            //    Often it's not in the list view.
            //    But for SuperRare, the 'creator' might be the first transfer 'from' 0x0?
            //    Or maybe description says "Artist: Bard Ionson"?
            //    Or we just take ALL of them if we assume the user only gave us contracts where they are the primary artist?
            //    The user said: "If you go to ... and press '1 of 1s' ... you will get a list".
            //    This implies the contract has other stuff.
            //    Wait, `0xb932...` is the *SuperRare V2* contract. It has thousands of artists.
            //    Fetching ALL and filtering is impossible (too big).
            //
            // **Correction**: We CANNOT fetch the whole SuperRare contract.
            // We must find a way to fetch *by creator*.
            // OpenSea endpoint `GET /nfts` allows `collection` slug but not `contract` + `creator` easily.
            //
            // **Alternative**: We use the `fetchCollectionNFTs` but for the *SuperRare* collection filtered?
            // User linked `https://superrare.com/bardionson`.
            // The items are likely in the "SuperRare" OpenSea collection.
            // Slug: `superrare`.
            // We can try to fetch collection `superrare`? No, that's huge.
            //
            // **Solution**: Use the `GET /nfts` endpoint with `collection=superrare` (or contract) AND `limit=50`.
            // But how to filter for Bard?
            // OpenSea API doesn't support "creator" filter on the generic endpoint easily.
            //
            // **Back to Scraping Idea**:
            // Since scraping failed partially, maybe I should just use the 12 items I found?
            // NO, user wants 128.
            //
            // **Observation**:
            // If I can't filter by creator via API, and scraping is flaky...
            // What if I search for "Bard Ionson" in the OpenSea collection "superrare"?
            // URL: `https://opensea.io/assets?search[query]=Bard%20Ionson`
            //
            // **Better Idea**:
            // Fetch *Account* NFTs?
            // `GET /chain/ethereum/account/{wallet}/nfts`
            // But user said "I do not want the NFTs I own".
            // Created NFTs often reside in the creator's wallet *initially*, but if sold, they are gone.
            //
            // **Revisiting Scraping**:
            // I will implement a simpler scraper for the SuperRare *API*?
            // SuperRare API is often `https://superrare.com/api/v2/user/bardionson/creations`?
            // Let's try to query SuperRare API directly in this script.

            // Fallback: Just return empty for now and try to hit SuperRare API below.
            break;
        } while (next && count < MAX_PAGES);
    } catch (e) { console.error(e); }

    return [];
}

async function fetchSuperRareCreations() {
    console.log("Attempting to fetch directly from SuperRare API...");
    const username = 'bardionson';
    const url = `https://superrare.com/api/v2/user?username=${username}`;

    try {
        // Get User ID
        const userRes = await axios.get(url);
        const userId = userRes.data.id;

        // Get Creations
        // Endpoint guess: /api/v2/user/{id}/creations
        // Or /api/v2/nft/by-user/{id}
        // Let's try to list artworks.

        // Actually, let's use a known endpoint structure or scrape the hidden API call from the site trace?
        // Site uses: `POST https://superrare.com/api/v2/nft/get-by-creator`

        const creationsUrl = 'https://superrare.com/api/v2/nft/get-by-creator';
        const payload = {
            "creatorId": userId,
            "filters": {
                "contractAddresses": SUPERRARE_CONTRACTS
            },
            "limit": 200, // User said 128
            "offset": 0
        };

        const artRes = await axios.post(creationsUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
        });

        const items = artRes.data.result || [];
        console.log(`Fetched ${items.length} items from SuperRare API.`);

        return items.map((item: any) => ({
            identifier: item.tokenId.toString(),
            collection: 'superrare', // Force into SuperRare group
            contract: item.contractAddress,
            token_standard: 'erc721',
            name: item.name,
            description: item.description,
            image_url: item.image,
            display_image_url: item.image,
            opensea_url: `https://opensea.io/assets/ethereum/${item.contractAddress}/${item.tokenId}`,
            updated_at: new Date().toISOString(),
            price: null,
            marketPrices: [
                {
                    market: 'SuperRare',
                    amount: item.latestPrice?.amount || item.listPrice?.amount || 0, // Simplified
                    currency: item.latestPrice?.currency || 'ETH',
                    url: `https://superrare.com/artwork/${item.tokenId}` // URL might vary
                }
            ]
        }));

    } catch (error: any) {
        console.error("SuperRare API failed:", error.message);
        return [];
    }
}

async function fetchListingsForContract(contract: string, tokenIds: string[]): Promise<Record<string, NFT['price']>> {
  const priceMap: Record<string, NFT['price']> = {};
  const BATCH_SIZE = 30;

  for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + BATCH_SIZE);
    const params = new URLSearchParams();
    params.append('asset_contract_address', contract);
    batch.forEach(id => params.append('token_ids', id));

    const url = `${BASE_URL}/orders/ethereum/seaport/listings?${params.toString()}`;

    try {
      const response = await axios.get(url, {
        headers: { 'x-api-key': OPENSEA_API_KEY, 'accept': 'application/json' }
      });

      const orders = response.data.orders || [];
      orders.forEach((order: any) => {
         if (order.side !== 'ask' || order.cancelled || order.finalized) return;
         const makerAsset = order.maker_asset_bundle?.assets?.[0];
         if (!makerAsset) return;

         const tokenId = makerAsset.token_id;
         const currentPriceWei = BigInt(order.current_price);
         const decimals = 18;
         const currentPriceEth = Number(currentPriceWei) / (10 ** decimals);

         if (!priceMap[tokenId] || currentPriceEth < priceMap[tokenId]!.amount) {
           priceMap[tokenId] = {
             amount: currentPriceEth,
             currency: 'ETH',
             decimals: decimals,
             raw: order.current_price
           };
         }
      });
    } catch (error) {
      console.error(`Error fetching listings for contract ${contract}:`, error);
    }
    await sleep(500);
  }
  return priceMap;
}

export async function getBardIonsonArt(): Promise<Record<string, CollectionGroup>> {
  let allNFTs: NFT[] = [];

  // 1. Fetch Targets (OpenSea)
  for (const target of TARGETS) {
    if (target.type === 'collection') {
      const nfts = await fetchCollectionNFTs(target.slug!);
      allNFTs = [...allNFTs, ...nfts];
    } else if (target.type === 'item') {
      const nfts = await fetchSingleNFT(target.chain!, target.contract!, target.tokenId!);
      allNFTs = [...allNFTs, ...nfts];
    }
  }

  // 2. Fetch SuperRare (Specific API)
  const srNFTs = await fetchSuperRareCreations();
  allNFTs = [...allNFTs, ...srNFTs];

  // Deduplicate
  const seen = new Set();
  const uniqueNFTs = allNFTs.filter(n => {
    const id = `${n.contract}-${n.identifier}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // 3. Fetch OpenSea Prices
  const contractMap: Record<string, string[]> = {};
  uniqueNFTs.forEach(nft => {
    if (!contractMap[nft.contract]) contractMap[nft.contract] = [];
    contractMap[nft.contract].push(nft.identifier);
  });

  const BATCH_SIZE_CONTRACTS = 5;
  const contractEntries = Object.entries(contractMap);

  for (let i = 0; i < contractEntries.length; i += BATCH_SIZE_CONTRACTS) {
    const batch = contractEntries.slice(i, i + BATCH_SIZE_CONTRACTS);

    await Promise.all(batch.map(async ([contract, tokenIds]) => {
      console.log(`Fetching listings for contract ${contract} (${tokenIds.length} items)...`);
      try {
        const prices = await fetchListingsForContract(contract, tokenIds);
        uniqueNFTs.forEach(nft => {
          if (nft.contract === contract && prices[nft.identifier]) {
            nft.price = prices[nft.identifier];
            // Also add to marketPrices
            if (!nft.marketPrices) nft.marketPrices = [];
            nft.marketPrices.push({
                market: 'OpenSea',
                amount: prices[nft.identifier]!.amount,
                currency: prices[nft.identifier]!.currency,
                url: nft.opensea_url
            });
          }
        });
      } catch (err) {
        console.error(`Failed to fetch listings for contract ${contract}`, err);
      }
    }));

    if (i + BATCH_SIZE_CONTRACTS < contractEntries.length) {
      await sleep(1000);
    }
  }

  // 4. Group by Collection
  const grouped: Record<string, CollectionGroup> = {};

  uniqueNFTs.forEach(nft => {
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
