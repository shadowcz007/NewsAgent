import axios from 'axios';

export interface NotionConfig {
  token: string;
  dataSourceId: string;
}

export interface NotionPage {
  id: string;
  properties: {
    Title: { title: Array<{ text: { content: string } }> };
    Content: { rich_text: Array<{ text: { content: string } }> };
    ID: { rich_text: Array<{ text: { content: string } }> };
  };
}

/**
 * 根据 ID（content_hash）查询 Notion page_id
 */
export async function findNotionPageByHash(
  config: NotionConfig,
  hashId: string
): Promise<string | null> {
  try {
    const response = await axios.post(
      `https://api.notion.com/v1/data_sources/${config.dataSourceId}/query`,
      {
        filter: {
          property: 'ID',
          rich_text: {
            equals: hashId,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Notion-Version': '2025-09-03',
          'Content-Type': 'application/json',
        },
      }
    );

    const results = response.data.results || [];
    if (results.length > 0) {
      return results[0].id;
    }

    return null;
  } catch (error: any) {
    console.error('Error finding Notion page:', error.response?.data || error.message);
    return null;
  }
}

/**
 * 在 Notion 中创建新页面
 */
export async function createNotionPage(
  config: NotionConfig,
  title: string,
  content: string,
  hashId: string
): Promise<string | null> {
  try {
    const response = await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: {
          type: 'data_source_id',
          data_source_id: config.dataSourceId,
        },
        properties: {
          Title: {
            title: [
              {
                text: {
                  content: title,
                },
              },
            ],
          },
          Content: {
            rich_text: [
              {
                text: {
                  content: content,
                },
              },
            ],
          },
          ID: {
            rich_text: [
              {
                text: {
                  content: hashId,
                },
              },
            ],
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Notion-Version': '2025-09-03',
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.id;
  } catch (error: any) {
    console.error('Error creating Notion page:', error.response?.data || error.message);
    return null;
  }
}

/**
 * 同步到 Notion（如果已存在则跳过）
 */
export async function syncToNotion(
  config: NotionConfig,
  title: string,
  content: string,
  hashId: string
): Promise<{ success: boolean; pageId: string | null; skipped: boolean }> {
  // 先查询是否已存在
  const existingPageId = await findNotionPageByHash(config, hashId);

  if (existingPageId) {
    return { success: true, pageId: existingPageId, skipped: true };
  }

  // 创建新页面
  const pageId = await createNotionPage(config, title, content, hashId);

  if (!pageId) {
    return { success: false, pageId: null, skipped: false };
  }

  return { success: true, pageId, skipped: false };
}

