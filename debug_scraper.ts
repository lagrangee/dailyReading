import { YouTubeScraper } from './src/lib/scrapers/youtube';
import { BilibiliScraper } from './src/lib/scrapers/bilibili';

async function debug() {
    const yt = new YouTubeScraper();
    console.log('\n--- Debugging YouTube ---');
    try {
        const ytLinks = await yt.scrape(['@a16z']);
        console.log('YouTube Results:', ytLinks);
    } catch (e) {
        console.error('YouTube failed:', e);
    }

    const bill = new BilibiliScraper();
    console.log('\n--- Debugging Bilibili ---');
    try {
        const billLinks = await bill.scrape(['3546710527707195']);
        console.log('Bilibili Results:', billLinks);
    } catch (e) {
        console.error('Bilibili failed:', e);
    }
}

debug();
