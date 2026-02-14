'use client';

import { useState } from 'react';
import { EnrichedCollection } from '@/lib/collection-utils';
import NFTCard from './NFTCard';
import { Grid, List, ArrowLeft, X } from 'lucide-react';
import Image from 'next/image';

interface GalleryProps {
  initialCollections: EnrichedCollection[];
}

type SortOption = 'date' | 'name' | 'price-asc' | 'price-desc';

export default function Gallery({ initialCollections }: GalleryProps) {
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('price-asc');

  const handleToggleCollection = (slug: string) => {
    const newSlugs = new Set(selectedSlugs);
    if (newSlugs.has(slug)) {
      newSlugs.delete(slug);
    } else {
      newSlugs.add(slug);
    }
    setSelectedSlugs(newSlugs);
  };

  const allNFTs = initialCollections
    .flatMap(c => c.nfts);

  const filteredNFTs = allNFTs
    .filter(nft => selectedSlugs.size === 0 || selectedSlugs.has(nft.collection));

  const sortedNFTs = [...filteredNFTs].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price-asc':
          // Items without price should be at the bottom? Or treated as 0?
          // Let's treat no price as Infinity so they go to bottom for "Low to High"
          // unless "Low to High" implies 0 is best? Usually implies "Cheapest first".
          // If 0, it comes first. Let's put unlisted items at bottom.
          const pA = a.price?.amount ?? Infinity;
          const pB = b.price?.amount ?? Infinity;
          return pA - pB;
        case 'price-desc':
          return (b.price?.amount || 0) - (a.price?.amount || 0);
        default:
          return 0;
      }
    });

  const showCollectionGrid = selectedSlugs.size === 0;

  if (showCollectionGrid) {
    return (
      <div className="space-y-6">
          <div className="flex justify-between items-center px-4 md:px-0">
             <div>
                <h2 className="text-2xl font-bold text-gray-800">Collections</h2>
                <span className="text-gray-500 text-sm">Select a collection to view art</span>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-4 md:px-0">
            {initialCollections.map((collection) => (
            <div
                key={collection.slug}
                onClick={() => handleToggleCollection(collection.slug)}
                className="cursor-pointer group relative block overflow-hidden rounded-2xl bg-white shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
                <div className="aspect-[4/3] w-full overflow-hidden bg-gray-200 relative">
                  {collection.coverImage ? (
                    <Image
                        src={collection.coverImage}
                        alt={collection.name}
                        fill
                        unoptimized
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500">
                      No Cover
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 transition-opacity" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="text-2xl font-bold text-white mb-1 drop-shadow-md">{collection.name}</h3>
                  <p className="text-white/90 font-medium bg-white/20 inline-block px-2 py-1 rounded-md text-xs backdrop-blur-md">
                    {collection.nfts.length} Items
                  </p>
                </div>
            </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div>
        <div className="mb-6 flex items-center justify-between px-4 md:px-0">
            <button
                onClick={() => setSelectedSlugs(new Set())}
                className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium transition-colors bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200"
            >
                <ArrowLeft size={18} className="mr-2" />
                Back to Collections
            </button>
        </div>

      <div className="flex flex-col md:flex-row gap-8 px-4 md:px-0">
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0 space-y-6">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm sticky top-4">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                    <h3 className="font-bold text-gray-900">Filter Collections</h3>
                    <button
                      onClick={() => setSelectedSlugs(new Set())}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Clear
                    </button>
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {initialCollections.map(c => {
                        const isSelected = selectedSlugs.has(c.slug);
                        return (
                            <button
                                key={c.slug}
                                onClick={() => handleToggleCollection(c.slug)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${isSelected ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'}`}
                            >
                                <span className="truncate flex-1 text-left">{c.name}</span>
                                <span className={`text-xs py-0.5 px-2 rounded-full ml-2 ${isSelected ? 'bg-white/20 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                                    {c.nfts.length}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="text-sm font-medium text-gray-500">
                    Showing <span className="font-bold text-gray-900">{sortedNFTs.length}</span> items
                </div>

                <div className="flex gap-4 items-center w-full sm:w-auto justify-end">
                    <div className="relative">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="appearance-none pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer hover:bg-gray-100 transition-colors"
                        >
                            <option value="date">Newest First</option>
                            <option value="name">Name A-Z</option>
                            <option value="price-asc">Price: Low to High</option>
                            <option value="price-desc">Price: High to Low</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                            </svg>
                        </div>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                            title="Grid View"
                        >
                            <Grid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                            title="List View"
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid/List */}
            <div className={viewMode === 'grid'
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "flex flex-col gap-3"
            }>
                {sortedNFTs.map(nft => (
                    <NFTCard key={`${nft.contract}-${nft.identifier}`} nft={nft} viewMode={viewMode} />
                ))}

                {sortedNFTs.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-gray-100 p-4 rounded-full mb-4">
                            <X size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No items found</h3>
                        <p className="text-gray-500 mt-1">Try selecting different collections.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
