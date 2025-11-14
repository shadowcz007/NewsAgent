import axios from 'axios';

export interface FeishuConfig {
  token: string;
  folderToken: string;
}

/**
 * 创建飞书文档
 */
export async function createFeishuDocument(
  config: FeishuConfig,
  title: string
): Promise<string | null> {
  try {
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/docx/v1/documents',
      {
        folder_token: config.folderToken,
        title: title,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.token}`,
        },
      }
    );

    if (response.data.code === 0) {
      return response.data.data.document.document_id;
    }

    console.error('Feishu API error:', response.data);
    return null;
  } catch (error: any) {
    console.error('Error creating Feishu document:', error.response?.data || error.message);
    return null;
  }
}

/**
 * 获取文档的所有块
 */
export async function getFeishuDocumentBlocks(
  config: FeishuConfig,
  documentId: string
): Promise<string | null> {
  try {
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/blocks?document_revision_id=-1&page_size=500`,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
        },
      }
    );

    if (response.data.code === 0 && response.data.data.items.length > 0) {
      // 找到第一个文本块（block_type 2）
      const textBlock = response.data.data.items.find(
        (item: any) => item.block_type === 2
      );

      if (textBlock) {
        return textBlock.block_id;
      }

      // 如果没有文本块，返回第一个块的 ID
      return response.data.data.items[0].block_id;
    }

    return null;
  } catch (error: any) {
    console.error('Error getting Feishu document blocks:', error.response?.data || error.message);
    return null;
  }
}

/**
 * 在飞书文档中添加内容块
 */
export async function addFeishuContentBlock(
  config: FeishuConfig,
  documentId: string,
  blockId: string,
  content: string
): Promise<boolean> {
  try {
    // 将内容按段落分割
    const paragraphs = content.split('\n\n').filter((p) => p.trim());

    const children = paragraphs.map((paragraph) => ({
      block_type: 2,
      text: {
        elements: [
          {
            text_run: {
              content: paragraph.trim(),
              text_element_style: {},
            },
          },
        ],
        style: {},
      },
    }));

    const response = await axios.post(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/blocks/${blockId}/children?document_revision_id=-1`,
      {
        children: children,
        index: 0,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.token}`,
        },
      }
    );

    return response.data.code === 0;
  } catch (error: any) {
    console.error('Error adding Feishu content block:', error.response?.data || error.message);
    return false;
  }
}

/**
 * 同步到飞书
 */
export async function syncToFeishu(
  config: FeishuConfig,
  title: string,
  content: string
): Promise<{ success: boolean; documentId: string | null }> {
  // 创建文档
  const documentId = await createFeishuDocument(config, title);

  if (!documentId) {
    return { success: false, documentId: null };
  }

  // 获取文档块
  const blockId = await getFeishuDocumentBlocks(config, documentId);

  if (!blockId) {
    return { success: false, documentId };
  }

  // 添加内容
  const success = await addFeishuContentBlock(config, documentId, blockId, content);

  return { success, documentId };
}

