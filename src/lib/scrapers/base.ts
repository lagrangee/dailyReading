export interface ScrapedLink {
  title: string;
  url: string;
  author: string;
  publishedAt: Date;
  source: string;
}

export abstract class BaseScraper {
  abstract platformName: string;
  abstract scrape(config: any): Promise<ScrapedLink[]>;

  protected isWithinLast24Hours(date: Date): boolean {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return date > twentyFourHoursAgo;
  }
}
