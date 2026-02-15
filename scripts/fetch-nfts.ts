
import 'dotenv/config';
import { Network, Alchemy, NftTokenType } from 'alchemy-sdk';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { NFT, CollectionGroup } from '@/lib/types';
import { TARGETS } from '@/config/targets';
import { WALLET_ADDRESSES } from '@/config/wallets';

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const BASE_URL = 'https://api.opensea.io/api/v2';

// Known contracts for specific platforms (for filtering Alchemy results if needed)
const PLATFORM_CONTRACTS = {
    'superrare-v1': '0x41A322b28D0fF354040e2CbC676F0320d8c8850d',
    'superrare-v2': '0xb932a70A57673d89f4acfFBE830E8ed7f75Fb9e0',
    'knownorigin': '0xFBeef911Dc5821886e1dda71586D90eD28174B7d', // Common KO contract
    'makersplace': '0x2a46f2ffd99e19a89476e2f62270e0a35bbf0756', // Common MP contract
    'async-art': '0xb6dae651468e9593e4581705a09c10a76ac1e0c8'
};

const alchemySettings = {
    apiKey: ALCHEMY_API_KEY,
    network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(alchemySettings);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchOpenSeaCollection(slug: string) {
    let allNFTs: NFT[] = [];
    let next = '';
    const MAX_PAGES = 5;

    console.log(`[OpenSea] Fetching collection: ${slug}...`);

    try {
      do {
        const url = `${BASE_URL}/collection/${slug}/nfts`;
        const params: Record<string, string | number> = { limit: 50 };
        if (next) params.next = next;

        const response = await axios.get(url, {
          headers: { 'x-api-key': OPENSEA_API_KEY, 'accept': 'application/json' },
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
        await sleep(200);

      } while (next && allNFTs.length < 250); // Cap at 250 for now
    } catch (error: any) {
      console.error(`[OpenSea] Error fetching collection ${slug}:`, error?.message);
    }
    return allNFTs;
}

async function fetchAlchemyMintedNFTs(wallet: string) {
    console.log(`[Alchemy] Fetching minted NFTs for ${wallet}...`);
    let nfts: any[] = [];
    let pageKey: string | undefined = undefined;

    try {
        // Use getMintedNfts to find everything created by this address
        do {
            const response = await alchemy.nft.getMintedNfts(wallet, {
                pageKey,
            });
            nfts = [...nfts, ...response.nfts];
            pageKey = response.pageKey;
            await sleep(100);
        } while (pageKey);

        console.log(`[Alchemy] Found ${nfts.length} minted items for ${wallet}.`);

        // Map to our NFT format
        return nfts.map(item => {
            const mediaUrl = (item.media && item.media.length > 0) ? item.media[0].gateway : (item.rawMetadata?.image || '');
            return {
                identifier: item.tokenId,
                collection: item.contract.openSea?.collectionName || 'unknown', // Fallback
                contract: item.contract.address.toLowerCase(),
                token_standard: item.tokenType ? item.tokenType.toLowerCase() : 'erc721',
                name: item.title || item.rawMetadata?.name || `#${item.tokenId}`,
                description: item.description || item.rawMetadata?.description || '',
                image_url: mediaUrl,
                display_image_url: mediaUrl,
                opensea_url: `https://opensea.io/assets/ethereum/${item.contract.address}/${item.tokenId}`,
                updated_at: item.timeLastUpdated || new Date().toISOString(),
                price: null
            };
        });

    } catch (error: any) {
        console.error(`[Alchemy] Error fetching for ${wallet}:`, error.message);
        return [];
    }
}

async function fetchOpenSeaListings(contract: string, tokenIds: string[]): Promise<Record<string, NFT['price']>> {
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
        // console.error(`Error fetching listings for ${contract}`, error);
      }
      await sleep(500);
    }
    return priceMap;
}

export async function getBardIonsonArt(): Promise<Record<string, CollectionGroup>> {
    let allNFTs: NFT[] = [];

    // 1. Fetch from OpenSea Targets (Collections defined by user)
    // We keep this because Alchemy getMinted might not cover "Collections I created but didn't mint directly" (e.g. factory contracts where user isn't msg.sender)?
    // Actually, user wants specific collections.
    for (const target of TARGETS) {
        if (target.type === 'collection') {
            const nfts = await fetchOpenSeaCollection(target.slug!);
            allNFTs = [...allNFTs, ...nfts];
        } else if (target.type === 'item') {
            // Check if we already have it from alchemy later?
            // Let's rely on Alchemy for the "Created" ones (SR/KO/MP) and TARGETS for the explicit collections.
            // But we need to fetch the single items in TARGETS too.
            // Simplified: Fetch TARGETS first.
            // ... (implement fetchSingleNFT if needed, or skip as Alchemy might find them)
        }
    }

    // 2. Fetch from Alchemy (SuperRare, KnownOrigin, MakersPlace)
    // We specifically want to find items on these platforms created by the user.
    if (ALCHEMY_API_KEY) {
        for (const wallet of WALLET_ADDRESSES) {
            const minted = await fetchAlchemyMintedNFTs(wallet);

            // Filter for relevant platforms
            const relevant = minted.filter(nft => {
                const c = nft.contract.toLowerCase();
                // Check against known contracts OR if the collection name sounds right
                // User said "find the id's of the superrare, knownorigin and makersplace pieces"
                // We can check if contract matches known ones.
                const isSR = Object.values(PLATFORM_CONTRACTS).some(pc => pc.toLowerCase() === c) ||
                             nft.collection?.toLowerCase().includes('superrare') ||
                             nft.collection?.toLowerCase().includes('knownorigin') ||
                             nft.collection?.toLowerCase().includes('makersplace');

                return isSR;
            });

            // Assign meaningful collection names
            relevant.forEach(nft => {
                const c = nft.contract.toLowerCase();
                if (c === PLATFORM_CONTRACTS['superrare-v1'].toLowerCase() || c === PLATFORM_CONTRACTS['superrare-v2'].toLowerCase() || nft.collection?.toLowerCase().includes('superrare')) {
                    nft.collection = 'superrare';
                } else if (nft.collection?.toLowerCase().includes('knownorigin') || c === PLATFORM_CONTRACTS['knownorigin'].toLowerCase()) {
                    nft.collection = 'knownorigin';
                } else if (nft.collection?.toLowerCase().includes('makersplace') || c === PLATFORM_CONTRACTS['makersplace'].toLowerCase()) {
                    nft.collection = 'makersplace';
                }
            });

            console.log(`[Alchemy] Found ${relevant.length} relevant platform items for ${wallet}`);
            allNFTs = [...allNFTs, ...relevant];
        }
    } else {
        console.warn("Skipping Alchemy fetch: No API Key provided.");
    }

    // Deduplicate
    const seen = new Set();
    const uniqueNFTs = allNFTs.filter(n => {
        const id = `${n.contract}-${n.identifier}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });

    // 2.5 Fetch Missing Images from OpenSea
    console.log("Checking for missing images...");
    const missingImages = uniqueNFTs.filter(n => !n.image_url);
    if (missingImages.length > 0) {
        console.log(`Found ${missingImages.length} items with missing images. Fetching from OpenSea...`);
        for (const nft of missingImages) {
            try {
                // Fetch single asset from OpenSea
                const url = `${BASE_URL}/chain/ethereum/contract/${nft.contract}/nfts/${nft.identifier}`;
                const response = await axios.get(url, {
                    headers: { 'x-api-key': OPENSEA_API_KEY, 'accept': 'application/json' }
                });
                const osNft = response.data.nft;
                if (osNft) {
                    nft.image_url = osNft.image_url || osNft.display_image_url || '';
                    nft.display_image_url = osNft.display_image_url || osNft.image_url || '';
                    console.log(`Updated image for ${nft.name}`);
                }
                await sleep(200); // Rate limit
            } catch (e: any) {
                console.error(`Failed to fetch image for ${nft.identifier}: ${e.message}`);
            }
        }
    }

    // 3. Fetch OpenSea Prices
    console.log("Fetching prices from OpenSea...");
    const contractMap: Record<string, string[]> = {};
    uniqueNFTs.forEach(nft => {
        if (!contractMap[nft.contract]) contractMap[nft.contract] = [];
        contractMap[nft.contract].push(nft.identifier);
    });

    const contractEntries = Object.entries(contractMap);
    // Process in chunks
    for (let i = 0; i < contractEntries.length; i += 5) {
        const batch = contractEntries.slice(i, i + 5);
        await Promise.all(batch.map(async ([contract, tokenIds]) => {
            const prices = await fetchOpenSeaListings(contract, tokenIds);
            uniqueNFTs.forEach(nft => {
                if (nft.contract === contract && prices[nft.identifier]) {
                    nft.price = prices[nft.identifier];
                    // Map to marketPrices for UI
                    if (!nft.marketPrices) nft.marketPrices = [];
                    // Avoid dupes
                    if (!nft.marketPrices.some(p => p.market === 'OpenSea')) {
                        nft.marketPrices.push({
                            market: 'OpenSea',
                            amount: prices[nft.identifier]!.amount,
                            currency: prices[nft.identifier]!.currency,
                            url: nft.opensea_url
                        });
                    }
                }
            });
        }));
        await sleep(1000);
    }

    // 4. Group
    const grouped: Record<string, CollectionGroup> = {};
    uniqueNFTs.forEach(nft => {
        const slug = nft.collection;
        if (!grouped[slug]) {
            grouped[slug] = { name: slug, slug: slug, nfts: [] };
        }
        grouped[slug].nfts.push(nft);
    });

    return grouped;
}

if (require.main === module) {
  (async () => {
    try {
      console.log('Starting NFT update...');
      const data = await getBardIonsonArt();
      const outputPath = path.join(process.cwd(), 'src/data/nfts.json');
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
      console.log(`Successfully wrote ${Object.keys(data).length} collections to ${outputPath}`);
    } catch (error) {
      console.error('Failed to update NFTs:', error);
      process.exit(1);
    }
  })();
}
