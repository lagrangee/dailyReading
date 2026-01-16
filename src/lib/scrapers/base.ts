export interface ScrapedLink {
  title: string;
  url: string;
  author: string;        // 频道名称
  authorId?: string;     // 频道 ID（用于匹配配置中的 source）
  authorAvatar?: string; // 频道头像 URL
  publishedAt: Date;
  source: string;
  transcript?: string;
  description?: string;
  formattedContent?: string;
}

export abstract class BaseScraper {
  abstract platformName: string;
  abstract scrape(config: any): Promise<ScrapedLink[]>;

  protected isWithinLast24Hours(date: Date): boolean {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return date > twentyFourHoursAgo;
  }
}
