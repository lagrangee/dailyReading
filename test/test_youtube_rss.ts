import { YouTubeScraper } from '../src/lib/scrapers/youtube';

async function test() {
    const scraper = new YouTubeScraper();
    // 测试 a16z 频道
    console.log('Testing YouTube RSS Scraper...');
    const results = await scraper.scrape(['a16z']);
    console.log('Results:', JSON.stringify(results, null, 2));
}

test().catch(console.error);
