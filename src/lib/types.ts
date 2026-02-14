export interface NFT {
  identifier: string;
  collection: string; // This is the slug
  contract: string;
  token_standard: string;
  name: string;
  description: string;
  image_url: string;
  display_image_url: string;
  opensea_url: string;
  updated_at: string;
  price?: {
    amount: number;
    currency: string;
    decimals: number;
    raw: string;
  } | null;
}

export interface CollectionGroup {
  name: string; // Display name (can be formatted)
  slug: string; // The key for grouping
  nfts: NFT[];
}
