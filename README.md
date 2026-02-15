# Bard Ionson Secondary Sales Gallery

A curated NFT gallery showcasing secondary sales for Bard Ionson's artwork across multiple platforms. This application aggregates listings from OpenSea and other marketplaces, presenting them in a unified, easy-to-browse interface.

## Features

*   **Curated Collection Display**: Showcases specific collections and individual items defined in the configuration.
*   **Multi-Platform Support**: Fetches NFT data from OpenSea and Alchemy to include works from SuperRare, KnownOrigin, MakersPlace, and more.
*   **Real-time Pricing**: Retrieves current listing prices from OpenSea to help collectors find available works.
*   **Advanced Filtering & Sorting**:
    *   Filter by specific collections.
    *   Sort by Price (Low to High / High to Low), Date (Newest / Oldest), or Name.
*   **View Modes**: Toggle between a visual Grid View and a detailed List View.
*   **Direct Marketplace Links**:
    *   One-click access to OpenSea listings.
    *   Direct links to SuperRare artworks for relevant pieces.
*   **Performance Optimized**: Uses static data generation to pre-fetch NFT metadata, ensuring fast page loads and reduced API usage during runtime.
*   **Responsive Design**: Built with Next.js and Tailwind CSS for a seamless experience on desktop and mobile.

## Tech Stack

*   **Framework**: [Next.js](https://nextjs.org/) (React)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Data Fetching**: [Alchemy SDK](https://docs.alchemy.com/), [Axios](https://axios-http.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)

## Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Configure Environment**:
    Create a `.env` file with your API keys:
    ```env
    OPENSEA_API_KEY=your_opensea_key
    ALCHEMY_API_KEY=your_alchemy_key
    ```

3.  **Fetch NFT Data**:
    Run the update script to fetch the latest NFT data and prices:
    ```bash
    npm run update-nfts
    ```

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```

5.  **Build for Production**:
    ```bash
    npm run build
    npm start
    ```

## Configuration

*   **Collections**: Defined in `src/config/collections.json`.
*   **Targets**: Specific contracts and tokens to fetch are listed in `src/config/targets.ts`.
*   **Wallets**: Wallet addresses to scan for minted works are in `src/config/wallets.ts`.
