import { foldVietnamese } from '../../common/utils/vietnamese';

export interface RankableHelpArticle {
  id: string;
  categoryId: string;
  title: string;
  body: string;
  keywords: string[];
  sortOrder: number;
  helpfulCount: number;
  notHelpfulCount: number;
  viewCount: number;
  [key: string]: any;
}

export interface RankedHelpArticle<T extends RankableHelpArticle = RankableHelpArticle> {
  article: T;
  score: number;
}

/**
 * Xếp hạng tìm kiếm bài viết trợ giúp không dấu:
 * Ưu tiên: Trùng khớp tiêu đề > Trùng khớp từ khoá (keywords) > Trùng khớp trong nội dung bài (body).
 * Tối đa 10 bài, sắp xếp theo điểm số phù hợp giảm dần.
 */
export function rankHelpArticles<T extends RankableHelpArticle>(
  articles: T[],
  query: string,
  limit: number = 10,
): T[] {
  const rawQ = query?.trim();
  if (!rawQ) {
    return [...articles]
      .sort((a, b) => a.sortOrder - b.sortOrder || b.viewCount - a.viewCount)
      .slice(0, limit);
  }

  const normalizedQ = foldVietnamese(rawQ);
  const queryTokens = normalizedQ.split(/\s+/).filter(Boolean);

  const scored: RankedHelpArticle<T>[] = [];

  for (const article of articles) {
    const titleNorm = foldVietnamese(article.title);
    const bodyNorm = foldVietnamese(article.body);
    const keywordsNorm = (article.keywords || []).map((k) => foldVietnamese(k));

    let score = 0;

    // 1. Tiêu đề (Khớp chính xác > Bắt đầu bằng > Chứa cả cụm > Chứa các từ)
    if (titleNorm === normalizedQ) {
      score += 150;
    } else if (titleNorm.startsWith(normalizedQ)) {
      score += 100;
    } else if (titleNorm.includes(normalizedQ)) {
      score += 70;
    }

    for (const token of queryTokens) {
      if (titleNorm.includes(token)) {
        score += 15;
      }
    }

    // 2. Từ khoá (Keywords)
    for (const kw of keywordsNorm) {
      if (kw === normalizedQ) {
        score += 80;
      } else if (kw.includes(normalizedQ)) {
        score += 45;
      } else {
        for (const token of queryTokens) {
          if (kw.includes(token)) {
            score += 10;
          }
        }
      }
    }

    // 3. Nội dung (Body)
    if (bodyNorm.includes(normalizedQ)) {
      score += 30;
    } else {
      for (const token of queryTokens) {
        if (bodyNorm.includes(token)) {
          score += 5;
        }
      }
    }

    // Chỉ đưa vào danh sách nếu có sự trùng khớp
    if (score > 0) {
      const popularityBonus = Math.min(
        article.viewCount * 0.05 + article.helpfulCount * 0.2 - article.notHelpfulCount * 0.1,
        10,
      );
      const finalScore = score + popularityBonus - article.sortOrder * 0.1;
      scored.push({ article, score: finalScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.article);
}

