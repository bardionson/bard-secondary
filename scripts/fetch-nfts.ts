
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { NFT, CollectionGroup } from '@/lib/types';
import { TARGETS } from '@/config/targets';

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const BASE_URL = 'https://api.opensea.io/api/v2';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchCollectionNFTs(slug: string) {
  let allNFTs: NFT[] = [];
  let next = '';
  const MAX_PAGES = 5; // Safety cap
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
        collection: slug, // Normalized
        contract: item.contract,
        token_standard: item.token_standard,
        name: item.name,
        description: item.description,
        image_url: item.image_url,
        display_image_url: item.display_image_url,
        opensea_url: item.opensea_url,
        updated_at: item.updated_at,
        price: null // Will fetch later
      }));

      allNFTs = [...allNFTs, ...nfts];
      next = response.data.next;
      count++;
      await sleep(200);

    } while (next && count < MAX_PAGES);
  } catch (error: any) {
    console.error(`Error fetching collection ${slug}:`, error?.message || String(error));
    // Some collections might be on Polygon or other chains not default to Ethereum in this endpoint?
    // v2/collection/{slug}/nfts usually handles chain automatically if slug is unique.
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
    // ... Reuse existing logic ...
    // Simplified for brevity in this snippet, full implementation below
    const priceMap: Record<string, NFT['price']> = {};
    const BATCH_SIZE = 30;

    for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
        const batch = tokenIds.slice(i, i + BATCH_SIZE);
        const params = new URLSearchParams();
        params.append('asset_contract_address', contract);
        batch.forEach(id => params.append('token_ids', id));

        try {
            const url = `${BASE_URL}/orders/ethereum/seaport/listings?${params.toString()}`;
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
            await sleep(500);
        } catch (e: any) { console.error(`Price fetch error for ${contract}`, e?.message || String(e)); }
    }
    return priceMap;
}

async function main() {
  console.log('Starting targeted NFT fetch...');
  let allNFTs: NFT[] = [];

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

  console.log(`Total unique NFTs found: ${uniqueNFTs.length}`);

  // Fetch Prices
  console.log('Fetching prices...');
  const contractMap: Record<string, string[]> = {};
  uniqueNFTs.forEach(nft => {
    if (!contractMap[nft.contract]) contractMap[nft.contract] = [];
    contractMap[nft.contract].push(nft.identifier);
  });

  for (const [contract, tokenIds] of Object.entries(contractMap)) {
      console.log(`Getting prices for ${contract} (${tokenIds.length} items)`);
      const prices = await fetchListingsForContract(contract, tokenIds);
      uniqueNFTs.forEach(nft => {
          if (nft.contract === contract && prices[nft.identifier]) {
              nft.price = prices[nft.identifier];
          }
      });
  }

  // Group
  const grouped: Record<string, CollectionGroup> = {};
  uniqueNFTs.forEach(nft => {
      const slug = nft.collection;
      if (!grouped[slug]) {
          grouped[slug] = { name: slug, slug: slug, nfts: [] };
      }
      grouped[slug].nfts.push(nft);
  });

  const dataDir = path.join(process.cwd(), 'src', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'nfts.json'), JSON.stringify(grouped, null, 2));
  console.log('Done.');
}

main().catch(console.error);
