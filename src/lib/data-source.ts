import fs from 'fs';
import path from 'path';
import { CollectionGroup } from '@/lib/types';
import { getBardIonsonArt as fetchFromOpenSea } from '@/lib/opensea';

export async function getBardIonsonArt(): Promise<Record<string, CollectionGroup>> {
  // In development or if explicitly requested, we can still fetch live
  // But for the static requirement, we read from the file.

  const dataDir = path.join(process.cwd(), 'src', 'data');
  const filePath = path.join(dataDir, 'nfts.json');

  if (fs.existsSync(filePath)) {
    console.log('Reading NFT data from local file...');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
  }

  // Fallback to live fetch if file is missing (e.g. first run locally without script)
  console.log('Local data file not found. Fetching from OpenSea...');
  return fetchFromOpenSea();
}
