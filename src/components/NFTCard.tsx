'use client';

import { NFT } from '@/lib/types';
import { ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

interface NFTCardProps {
  nft: NFT;
  viewMode: 'grid' | 'list';
}

const formatPrice = (price: NFT['price']) => {
  if (!price) return null;
  // Display up to 4 decimal places, trimming trailing zeros if possible, or just fixed
  return `${Number(price.amount).toFixed(4).replace(/\.?0+$/, '')} ${price.currency}`;
};

export default function NFTCard({ nft, viewMode }: NFTCardProps) {
  const [imgSrc, setImgSrc] = useState(nft.image_url || nft.display_image_url || '/placeholder.png');
  const [error, setError] = useState(false);

  const priceDisplay = formatPrice(nft.price);

  // If list view
  if (viewMode === 'list') {
    return (
      <div className="group flex items-center gap-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-3 border border-gray-100">
        <div className="w-16 h-16 relative overflow-hidden rounded-lg bg-gray-200 shrink-0">
          <Image
            src={error ? '/placeholder.png' : imgSrc}
            alt={nft.name || 'NFT'}
            fill
            unoptimized
            className="object-cover"
            onError={() => { setError(true); setImgSrc('/placeholder.png'); }}
            sizes="(max-width: 64px) 100vw, 64px"
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{nft.name || `#${nft.identifier}`}</h3>
          <p className="text-sm text-gray-500 truncate">{nft.collection}</p>
        </div>

        {priceDisplay && (
          <div className="text-right px-4">
            <span className="block font-bold text-gray-900">{priceDisplay}</span>
            <span className="text-xs text-gray-500">Price</span>
          </div>
        )}

        <div className="text-right">
          <a
            href={nft.opensea_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            OpenSea <ExternalLink size={14} className="ml-1" />
          </a>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="group bg-white rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="aspect-square relative overflow-hidden bg-gray-200">
        <Image
          src={error ? '/placeholder.png' : imgSrc}
          alt={nft.name || 'NFT'}
          fill
          unoptimized
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          onError={() => { setError(true); setImgSrc('/placeholder.png'); }}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />

        {/* Price Badge on Image */}
        {priceDisplay && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
            {priceDisplay}
          </div>
        )}

        {/* Overlay with Quick Actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <a
                href={nft.opensea_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-gray-900 px-4 py-2 rounded-full font-medium text-sm hover:bg-gray-100 transform translate-y-2 group-hover:translate-y-0 transition-transform"
            >
                View on OpenSea
            </a>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1">
            <h3 className="font-bold text-gray-900 truncate flex-1 pr-2" title={nft.name}>
                {nft.name || `#${nft.identifier}`}
            </h3>
        </div>
        <p className="text-sm text-gray-500 mb-auto truncate">{nft.collection}</p>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
            <span className="text-xs text-gray-400">
                {new Date(nft.updated_at).toLocaleDateString()}
            </span>
            {priceDisplay && (
              <span className="text-sm font-bold text-gray-900">
                {priceDisplay}
              </span>
            )}
        </div>
      </div>
    </div>
  );
}
