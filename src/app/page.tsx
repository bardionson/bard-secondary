import { getBardIonsonArt } from '@/lib/data-source';
import { enrichAndSortCollections } from '@/lib/collection-utils';
import Gallery from '@/components/Gallery';

// Use ISR to regenerate the page every hour (for prices, if we were splitting)
// But since the user wants the file to be static, we can stick to ISR or static.
// The file is read at build time (or revalidation time).
export const revalidate = 3600;

export default async function Home() {
  const grouped = await getBardIonsonArt();
  const collections = enrichAndSortCollections(grouped);

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Bard Ionson
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Secondary Market & Archive
          </p>
        </div>

        <Gallery initialCollections={collections} />
      </div>
    </main>
  );
}
