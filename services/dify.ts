import axios from 'axios';
import { DIFY_DATASET_ID, DIFY_API_KEY, DIFY_API_URL } from '@/lib/constants';

// Dify 知识检索结果
export interface DifyRetrievalResult {
  content: string;
  score?: number;
}

// 从 Dify 知识库检索历史知识
export async function retrieveKnowledge(query: string, topK: number = 2): Promise<DifyRetrievalResult[]> {
  if (!query || !query.trim()) {
    return [];
  }

  try {
    const url = `${DIFY_API_URL}/${DIFY_DATASET_ID}/retrieve`;
    
    const response = await axios.post(
      url,
      {
        query: query.trim(),
        retrieval_model: {},
        // top_k: topK,
      },
      {
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000, // 5秒超时
      }
    );

    // 解析响应数据
    if (response.data?.records && Array.isArray(response.data.records)) {
      return response.data.records.slice(0, topK).map((item: any) => ({
        content: item.segment?.content || '',
        score: item.score || item.relevance_score,
      })).filter((item: DifyRetrievalResult) => item.content.trim().length > 0);
    }

    return [];
  } catch (error: any) {
    // 容错处理：失败时返回空数组，不影响简报生成
    console.error('Error retrieving knowledge from Dify:', error.message || error);
    return [];
  }
}

