
import axios from 'axios';

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY || 'f2c2813654d144f7860a418f0d850b46';
const WALLET = '0x72774bc572ef9a2dFF47c3F8Cc200DC2fe3830C0';
const SR_V2 = '0xb932a70A57673d89f4acfFBE830E8ed7f75Fb9e0';

async function debugEvents() {
    console.log(`Debugging events for ${WALLET}...`);

    // Check transfers TO the wallet
    const url = `https://api.opensea.io/api/v2/events/accounts/${WALLET}`;

    try {
        const response = await axios.get(url, {
            headers: { 'x-api-key': OPENSEA_API_KEY, 'accept': 'application/json' },
            params: {
                event_type: 'transfer',
                limit: 5 // Just get a few to inspect
            }
        });

        console.log(`Got ${response.data.asset_events?.length} events.`);

        // Print one to see structure
        if (response.data.asset_events?.length > 0) {
            console.log(JSON.stringify(response.data.asset_events[0], null, 2));
        }

    } catch (e) {
        console.error(e.message);
    }
}

debugEvents();
