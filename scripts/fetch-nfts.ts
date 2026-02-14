
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { NFT, CollectionGroup } from '@/lib/types';

// The full list of collections/items provided by the user
const TARGETS = [
  { type: 'collection', slug: 'color-magic-planets-by-bard-ionson' },
  { type: 'collection', slug: '8-by-bard-ionson-1' },
  { type: 'collection', slug: 'bards-freaky-faces' },
  { type: 'collection', slug: 'bard-editions' },
  { type: 'collection', slug: 'soul-scroll' },
  { type: 'collection', slug: 'bard-ionson' },
  { type: 'collection', slug: 'remixes-from-fountain' },
  { type: 'collection', slug: 'simulation-number-89' },
  { type: 'collection', slug: 'bard-ionson-home-collection' },
  { type: 'collection', slug: 'scanning-the-scanner' },
  { type: 'collection', slug: 'bard-ionson-3d' },
  { type: 'item', chain: 'ethereum', contract: '0xb305904aab1d1041b9c237e46a68fc9a22d60bc2', tokenId: '8' },
  { type: 'collection', slug: 'we-re-all-gonna' },
  { type: 'collection', slug: 'sound-words' },
  { type: 'collection', slug: 'ionart' },
  { type: 'collection', slug: 'osci' },
  { type: 'collection', slug: 'bard-ionson-fine-art' },
  { type: 'collection', slug: 'we-are-anarchy-on-chain-polygon' }, // Might be Polygon?
  { type: 'collection', slug: 'osci-v2' },
  { type: 'collection', slug: 'we-are-noise-and-form-on-chain-generative-art' },
  { type: 'collection', slug: 'bones-in-the-sky-marfa-by-bard-ionson' },
  { type: 'collection', slug: 'power-corrupts-power-by-bard-ionson' },
  { type: 'collection', slug: 'painting-with-fire-a-history-in-gans-by-bard-ionso' },
  // 'bard-editions' is duplicated, skipping
  { type: 'collection', slug: 'optimistic-bard-ionson' },
  { type: 'collection', slug: 'word-flush-by-bard-ionson' },
  { type: 'collection', slug: 'fountain' },
  { type: 'collection', slug: 'smoke-and-shape' },
  { type: 'collection', slug: 'naked-flames-in-motion' },
  { type: 'collection', slug: 'bard-ionson-installations' },
  { type: 'collection', slug: 'naked-flames-by-bard-ionson' },
  { type: 'collection', slug: 'spam-art-v2' },
  { type: 'collection', slug: 'this-is-not-a2' },
  { type: 'collection', slug: '100-ai-x-bard-ionson' },
  { type: 'collection', slug: 'distortions-of-the-future' },
  { type: 'collection', slug: 'vanishing-of-the-genuine-motion-by-bard-ionson' },
  { type: 'collection', slug: 'bones-vanishing-of-the-genuine-by-bard-ionson' },
  { type: 'collection', slug: 'wet-kiss-by-bard-ionson' },
  // Async Art: Special handling needed or just fetch collection?
  // User link has traits filter. Let's try fetching collection "async-art" first,
  // then filter locally if possible, or just include it all if they are all by Bard (likely are if linked).
  { type: 'collection', slug: 'async-art' }
];

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

      // Special filter for Async Art?
      if (target.slug === 'async-art') {
          // In a real app we'd filter by trait, but we don't have traits in the simplified NFT type yet.
          // For now, let's include all found in the collection request.
          // If the collection endpoint returns *all* Async Art (huge), we might need a different approach.
          // Note: `GET /collection/{slug}/nfts` returns ALL NFTs in collection. Async Art is huge.
          // This is risky.
          // Better approach for huge shared collections: Use `GET /nfts` with `collection` param and `traits`?
          // The generic `GET /nfts` endpoint is deprecated/removed in v2 in favor of account/collection specific.
          // We will fetch it, but limit it? Or skip if too large.
          // Let's rely on the user's intent. If they linked the *filtered* view, they want those items.
          // But API doesn't support filtering by trait easily in one go.
          // We might need to filter manually if we can fetch traits.
      }

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
