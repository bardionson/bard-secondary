import axios from 'axios';
import { TARGETS } from '@/config/targets';
import { NFT, CollectionGroup } from './types';

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const BASE_URL = 'https://api.opensea.io/api/v2';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
  let allNFTs: NFT[] = [];

  // 1. Fetch Targets
  for (const target of TARGETS) {
    if (target.type === 'collection') {
      const nfts = await fetchCollectionNFTs(target.slug!);
      allNFTs = [...allNFTs, ...nfts];
    } else if (target.type === 'item') {
      const nfts = await fetchSingleNFT(target.chain!, target.contract!, target.tokenId!);
      allNFTs = [...allNFTs, ...nfts];
    }
  }

  // Deduplicate
  const seen = new Set();
  const uniqueNFTs = allNFTs.filter(n => {
    const id = `${n.contract}-${n.identifier}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // 2. Fetch Prices (Group by Contract)
  const contractMap: Record<string, string[]> = {};
  uniqueNFTs.forEach(nft => {
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
        uniqueNFTs.forEach(nft => {
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
