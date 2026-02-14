
import fs from 'fs';
import path from 'path';
import { getBardIonsonArt } from '../src/lib/opensea';

async function main() {
  console.log('Fetching NFT data from OpenSea...');
  const grouped = await getBardIonsonArt();

  const dataDir = path.join(process.cwd(), 'src', 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const filePath = path.join(dataDir, 'nfts.json');
  fs.writeFileSync(filePath, JSON.stringify(grouped, null, 2));
  console.log(`NFT data saved to ${filePath}`);
}

main().catch(console.error);
