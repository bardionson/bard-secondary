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
  return `${Number(price.amount).toFixed(4).replace(/\.?0+$/, '')} ${price.currency}`;
};

export default function NFTCard({ nft, viewMode }: NFTCardProps) {
  const [imgSrc, setImgSrc] = useState(nft.image_url || nft.display_image_url || '/placeholder.png');
  const [error, setError] = useState(false);

  // Determine which prices to show
  // If marketPrices exists, use that. Otherwise fallback to main price.
  const prices = nft.marketPrices || [];

  // If no marketPrices but we have main price, treat it as OpenSea
  if (prices.length === 0 && nft.price) {
      prices.push({
          market: 'OpenSea',
          amount: nft.price.amount,
          currency: nft.price.currency,
          url: nft.opensea_url
      });
  }

  // Sort prices? Maybe show lowest first? Or show all.
  // User asked to "Show the list price on SuperRare and OpenSea if there is one".

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

        <div className="text-right px-4 flex flex-col gap-1">
          {prices.length > 0 ? (
              prices.map((p, idx) => (
                  <div key={idx} className="text-sm">
                      <span className="font-bold text-gray-900">{p.amount} {p.currency}</span>
                      <span className="text-xs text-gray-500 ml-1">({p.market})</span>
                  </div>
              ))
          ) : (
              <span className="text-sm text-gray-400">Not Listed</span>
          )}
        </div>

        <div className="text-right flex flex-col items-end gap-1">
          <a
            href={nft.opensea_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            OpenSea <ExternalLink size={14} className="ml-1" />
          </a>
          {nft.superrare_url && (
            <a
              href={nft.superrare_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-800"
            >
              SuperRare <ExternalLink size={14} className="ml-1" />
            </a>
          )}
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

        {/* Price Badges on Image */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {prices.map((p, idx) => (
                <div key={idx} className="bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                    {p.amount} {p.currency} <span className="opacity-70 font-normal ml-1">{p.market}</span>
                </div>
            ))}
        </div>

        {/* Overlay with Quick Actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
            <a
                href={nft.opensea_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-gray-900 px-4 py-2 rounded-full font-medium text-sm hover:bg-gray-100 transform translate-y-2 group-hover:translate-y-0 transition-transform"
            >
                View on OpenSea
            </a>
            {nft.superrare_url && (
              <a
                href={nft.superrare_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-black text-white px-4 py-2 rounded-full font-medium text-sm hover:bg-gray-800 transform translate-y-2 group-hover:translate-y-0 transition-transform"
              >
                View on SuperRare
              </a>
            )}
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
            {/* If no prices, show placeholder or nothing? */}
            {prices.length === 0 && (
                <span className="text-xs text-gray-300">--</span>
            )}
        </div>
      </div>
    </div>
  );
}
