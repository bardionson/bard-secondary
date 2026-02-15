import collectionsConfig from '@/config/collections.json';
import { CollectionGroup } from '@/lib/types';

export interface EnrichedCollection extends CollectionGroup {
  priority: number;
  coverImage: string;
}

interface CollectionConfig {
  displayName: string;
  priority: number;
  coverImage?: string;
}

// Ensure type safety for the JSON import
const config = collectionsConfig as Record<string, CollectionConfig | undefined>;

export function enrichAndSortCollections(
  grouped: Record<string, CollectionGroup>
): EnrichedCollection[] {
  const enriched: EnrichedCollection[] = [];

  for (const slug in grouped) {
    const group = grouped[slug];
    const settings = config[slug];

    let displayName = group.name;
    let priority = 0;
    let coverImage = '';

    if (settings) {
      displayName = settings.displayName;
      priority = settings.priority;
      coverImage = settings.coverImage || '';
    }

    if (!coverImage && group.nfts.length > 0) {
      // Find first NFT with a valid image - search from the end (newest usually)
      // because sometimes older items have broken images or user prefers newer ones.
      const nftWithImage = group.nfts.slice().reverse().find(n => n.image_url || n.display_image_url);
      if (nftWithImage) {
        coverImage = nftWithImage.display_image_url || nftWithImage.image_url;
      }
    }

    enriched.push({
      ...group,
      name: displayName,
      priority,
      coverImage: coverImage || '/placeholder.png'
    });
  }

  // Sort by Priority (desc), then Name (asc)
  return enriched.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return a.name.localeCompare(b.name);
  });
}
