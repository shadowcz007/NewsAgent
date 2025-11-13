import axios from 'axios';
import { 
  SILICONFLOW_API_KEY, 
  SILICONFLOW_API_URL, 
  SILICONFLOW_MODEL,
  LLM_MODEL_CLASSIFY,
  LLM_MODEL_TRANSLATE,
  LLM_MODEL_BRIEFING
} from '@/lib/constants';
import { HotspotItem } from './hotspot';

export interface TranslatedItem {
  translated_title: string;
  source_url: string;
  category: '技术工具' | '前沿研究' | '行业动态' | '其他';
}

// 辅助函数：延迟
const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 辅助函数：将数组分批
function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

// 判断是否为可重试的错误
function isRetryableError(error: any): boolean {
  // 503 Service Unavailable 或其他5xx错误
  if (error.response?.status >= 500 && error.response?.status < 600) {
    return true;
  }
  // 网络错误或超时
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }
  // 429 Too Many Requests
  if (error.response?.status === 429) {
    return true;
  }
  return false;
}

// 翻译分类整理的 System Prompt
const TRANSLATE_CATEGORIZE_PROMPT = `你是一个专业的信息处理助手，负责将输入的资讯条目进行结构化处理。你的任务是：

1. **准确翻译**：将每条资讯的标题从英文翻译为自然、流畅的中文，保留专业术语的准确性，避免生硬直译。
2. **精确分类**：根据内容实质，将每条资讯归入以下四类之一：
  * **社会新闻**：指关于社会新闻、社会事件、社会现象、社会问题、社会热点、社会趋势的新闻。
  * **技术工具**：指可被开发者直接使用、集成或调用的软件、开源库、CLI工具、API、插件等。
  * **前沿研究**：指基于学术论文、实验发现或科学突破的成果，旨在解决基础科学或工程难题，通常发表于学术平台或权威媒体。
  * **科技行业动态**：指关于科技公司战略、市场趋势、融资、政策、重大合作或产业生态变化的新闻。
  * **其他**：无法明确归入以上四类的条目。
3. **结构化输出**：严格输出一个 JSON 对象数组，每个对象包含且仅包含以下三个键：\`"translated_title"\`、\`"source_url"\`、\`"category"\`。**不要**包含任何额外的解释、说明、Markdown 格式或注释。`;

// 个性化输出简报的 System Prompt
const BRIEFING_PROMPT = `你是一个敏锐的 AI 创业观察者，以「创业者日记」的口吻处理输入的资讯条目列表（每个条目含 \`"translated_title"\`、\`"source_url"\`、\`"category"\`）。  

**默认行为（用户未提供额外要求时）**：  
- 用不超过 140 字提炼所有条目的**共同洞察**，而非罗列事实。  
- 聚焦三件事：**谁在解决什么真问题？为何此刻重要？隐含何种范式转移？**  
- 优先捕捉具备**自然语言界面、氛围编程（Vibe Coding）或 AI Agent 协作潜力**的信号。  
- 语气带判断、有情绪，像你真的会记在备忘录里的那句话。  

**若用户提供了自定义要求**：  
- 严格按用户要求生成 140 字内简报，仍保持精炼、洞察导向、拒绝泛泛而谈。  

**输出格式固定为两段**：  
1. **第一段**：140 字内的日记体简报（含情绪与判断）。  
2. **第二段**：来源清单，列出140字日记体简报所提及的条目的 \`source_url\`，每行一个**来源url**。  

永远不解释、不总结格式、不添加额外文本。`;

// 调用硅基流动 API（带重试机制）
async function callSiliconFlow(
  messages: Array<{ role: string; content: string }>,
  retryCount: number = 0,
  maxRetries: number = 3,
  model: string = SILICONFLOW_MODEL
): Promise<string> {
  try {
    const response = await axios.post(
      SILICONFLOW_API_URL,
      {
        model: model,
        messages,
      },
      {
        headers: {
          Authorization: `Bearer ${SILICONFLOW_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content || '';
    }
    throw new Error('Invalid response from SiliconFlow API');
  } catch (error: any) {
    // 判断是否为可重试的错误
    if (isRetryableError(error) && retryCount < maxRetries) {
      const retryDelay = 5000 * Math.pow(2, retryCount); // 指数退避：5s, 10s, 20s
      console.log(
        `LLM API 调用失败，${retryDelay / 1000}秒后重试 (${retryCount + 1}/${maxRetries}):`,
        error.response?.status || error.code || error.message
      );
      
      await delay(retryDelay);
      return callSiliconFlow(messages, retryCount + 1, maxRetries, model);
    }
    
    // 不可重试的错误或已达到最大重试次数
    console.error('Error calling SiliconFlow API:', error);
    throw new Error(`LLM API error: ${error.message}`);
  }
}

/**
 * 辅助函数：修复常见的 JSON 格式问题
 * 处理尾随逗号、未转义字符等常见错误
 */
function fixCommonJsonIssues(jsonStr: string): string {
  // 1. 移除尾随逗号（在数组或对象最后一个元素后）
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
  
  // 2. 转义字符串值中的所有控制字符（使用状态机方式）
  // 这样可以准确识别字符串边界，避免误转义已转义的字符
  let result = '';
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    const code = char.charCodeAt(0);
    
    if (escapeNext) {
      // 当前字符是转义序列的一部分，直接添加
      result += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      // 遇到反斜杠，下一个字符需要跳过
      escapeNext = true;
      result += char;
      continue;
    }
    
    if (char === '"') {
      // 遇到引号，切换字符串状态
      inString = !inString;
      result += char;
      continue;
    }
    
    if (inString && code < 0x20) {
      // 在字符串内且是控制字符（0x00-0x1F），需要转义
      switch (code) {
        case 0x08: result += '\\b'; break;  // 退格
        case 0x09: result += '\\t'; break;  // 制表符
        case 0x0A: result += '\\n'; break;  // 换行
        case 0x0C: result += '\\f'; break;  // 换页
        case 0x0D: result += '\\r'; break;  // 回车
        default: 
          // 其他控制字符使用 Unicode 转义
          result += `\\u${code.toString(16).padStart(4, '0')}`; 
          break;
      }
    } else {
      result += char;
    }
  }
  
  // 3. 移除 BOM 和其他不可见字符
  result = result.replace(/^\uFEFF/, '');
  
  return result;
}

/**
 * 辅助函数：多策略 JSON 解析
 * 依次尝试 5 种不同的解析策略，提高成功率
 */
function parseJsonResponse(response: string, batchNumber: number): TranslatedItem[] {
  const strategies = [
    // 策略 1: 直接解析
    () => {
      console.log(`第 ${batchNumber} 批：尝试策略 1 - 直接解析`);
      return JSON.parse(response);
    },
    
    // 策略 2: 移除 markdown 代码块后解析
    () => {
      console.log(`第 ${batchNumber} 批：尝试策略 2 - 移除 markdown 代码块`);
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned);
    },
    
    // 策略 3: 使用正则提取 JSON 并修复常见问题
    () => {
      console.log(`第 ${batchNumber} 批：尝试策略 3 - 正则提取并修复`);
      let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      // 尝试找到第一个 [ 或 { 到最后一个 ] 或 }
      const startArray = cleaned.indexOf('[');
      const startObject = cleaned.indexOf('{');
      const endArray = cleaned.lastIndexOf(']');
      const endObject = cleaned.lastIndexOf('}');
      
      let jsonStr = '';
      if (startArray !== -1 && endArray !== -1 && (startObject === -1 || startArray < startObject)) {
        // 看起来是数组
        jsonStr = cleaned.substring(startArray, endArray + 1);
      } else if (startObject !== -1 && endObject !== -1) {
        // 看起来是对象
        jsonStr = cleaned.substring(startObject, endObject + 1);
      } else {
        throw new Error('No valid JSON structure found');
      }
      
      // 修复常见问题
      jsonStr = fixCommonJsonIssues(jsonStr);
      return JSON.parse(jsonStr);
    },
    
    // 策略 4: 逐行清理后解析
    () => {
      console.log(`第 ${batchNumber} 批：尝试策略 4 - 逐行清理`);
      const lines = response.split('\n');
      const jsonLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed && 
               !trimmed.startsWith('```') && 
               !trimmed.startsWith('//') &&
               !trimmed.startsWith('#');
      });
      const cleaned = jsonLines.join('\n').trim();
      const fixed = fixCommonJsonIssues(cleaned);
      return JSON.parse(fixed);
    },
    
    // 策略 5: 提取最大的 JSON 结构
    () => {
      console.log(`第 ${batchNumber} 批：尝试策略 5 - 提取最大 JSON 结构`);
      // 查找所有可能的 JSON 数组
      const arrayMatches = response.matchAll(/\[[\s\S]*?\]/g);
      let longestMatch = '';
      
      for (const match of arrayMatches) {
        if (match[0].length > longestMatch.length) {
          try {
            const fixed = fixCommonJsonIssues(match[0]);
            JSON.parse(fixed); // 测试是否有效
            longestMatch = match[0];
          } catch (e) {
            // 继续尝试下一个
          }
        }
      }
      
      if (longestMatch) {
        const fixed = fixCommonJsonIssues(longestMatch);
        return JSON.parse(fixed);
      }
      
      throw new Error('No valid JSON array found');
    },
  ];
  
  // 依次尝试每个策略
  let lastError: any = null;
  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]();
      console.log(`第 ${batchNumber} 批：策略 ${i + 1} 成功解析`);
      
      // 验证结果是数组
      if (!Array.isArray(result)) {
        throw new Error('Parsed result is not an array');
      }
      
      return result as TranslatedItem[];
    } catch (error: any) {
      lastError = error;
      console.log(`第 ${batchNumber} 批：策略 ${i + 1} 失败: ${error.message}`);
    }
  }
  
  // 所有策略都失败
  throw new Error(`所有解析策略都失败。最后错误: ${lastError?.message || 'Unknown'}`);
}

// 翻译和分类热点条目（分批处理）
export async function translateAndCategorize(items: HotspotItem[]): Promise<TranslatedItem[]> {
  if (items.length === 0) {
    return [];
  }

  const BATCH_SIZE = 20;
  const BATCH_DELAY = 10000; // 10秒延迟
  const batches = batchArray(items, BATCH_SIZE);
  const allResults: TranslatedItem[] = [];

  console.log(`开始分批处理 ${items.length} 条热点，共 ${batches.length} 批，每批 ${BATCH_SIZE} 条`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNumber = i + 1;
    
    try {
      console.log(`处理第 ${batchNumber}/${batches.length} 批（${batch.length} 条）...`);

      // 构建输入内容
      const inputContent = batch.map((item, index) => 
        `${index + 1}. Title: ${item.title}\n   URL: ${item.url}\n   Summary: ${item.summary || ''}`
      ).join('\n\n');

      const messages = [
        { role: 'system', content: TRANSLATE_CATEGORIZE_PROMPT },
        { role: 'user', content: `请处理以下资讯条目：\n\n${inputContent}` },
      ];

      const response = await callSiliconFlow(messages, 0, 3, LLM_MODEL_TRANSLATE);
      
      // 尝试解析 JSON 响应（多重策略）
      let parsed: TranslatedItem[];
      try {
        parsed = parseJsonResponse(response, batchNumber);
      } catch (parseError) {
        console.error(`第 ${batchNumber} 批解析失败:`, parseError);
        console.error(`原始响应前200字符:`, response.substring(0, 200));
        // 使用后备数据
        parsed = batch.map(item => ({
          translated_title: item.title,
          source_url: item.url,
          category: '其他' as TranslatedItem['category'],
        }));
      }

      // 验证和修正数据
      const batchResults = parsed.map((item, index) => ({
        translated_title: item.translated_title || batch[index]?.title || '',
        source_url: item.source_url || batch[index]?.url || '',
        category: (['技术工具', '前沿研究', '行业动态', '其他'].includes(item.category) 
          ? item.category 
          : '其他') as TranslatedItem['category'],
      }));

      allResults.push(...batchResults);
      console.log(`第 ${batchNumber} 批处理完成，成功处理 ${batchResults.length} 条`);

      // 如果不是最后一批，添加延迟
      if (i < batches.length - 1) {
        console.log(`等待 ${BATCH_DELAY / 1000} 秒后处理下一批...`);
        await delay(BATCH_DELAY);
      }
    } catch (error: any) {
      console.error(`第 ${batchNumber} 批处理失败:`, error.message);
      // 单个批次失败时，使用后备数据继续处理
      const fallbackResults = batch.map(item => ({
        translated_title: item.title,
        source_url: item.url,
        category: '其他' as TranslatedItem['category'],
      }));
      allResults.push(...fallbackResults);
      console.log(`第 ${batchNumber} 批使用后备数据，已处理 ${fallbackResults.length} 条`);

      // 即使失败也继续处理下一批，但添加延迟
      if (i < batches.length - 1) {
        console.log(`等待 ${BATCH_DELAY / 1000} 秒后处理下一批...`);
        await delay(BATCH_DELAY);
      }
    }
  }

  console.log(`所有批次处理完成，共处理 ${allResults.length}/${items.length} 条`);
  return allResults;
}

// 生成个性化简报
export async function generateBriefing(
  items: TranslatedItem[],
  customRequirement?: string
): Promise<{ briefing: string; sources: string[] }> {
  if (items.length === 0) {
    return { briefing: '暂无热点资讯', sources: [] };
  }

  // 构建输入内容
  const inputContent = JSON.stringify(items, null, 2);

  const userPrompt = customRequirement 
    ? `用户要求：${customRequirement}\n\n资讯条目：\n${inputContent}`
    : `资讯条目：\n${inputContent}`;

  const messages = [
    { role: 'system', content: BRIEFING_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await callSiliconFlow(messages, 0, 3, LLM_MODEL_BRIEFING);
    
    // 解析两段格式
    const parts = response.split('\n\n');
    const briefing = parts[0] || response;
    
    // 提取来源 URL
    const sources: string[] = [];
    if (parts.length > 1) {
      const sourceLines = parts[1].split('\n');
      for (const line of sourceLines) {
        const url = line.trim();
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          sources.push(url);
        }
      }
    }

    return { briefing, sources };
  } catch (error: any) {
    console.error('Error in generateBriefing:', error);
    // 返回简单的后备简报
    return {
      briefing: `今日共收集 ${items.length} 条热点资讯，涵盖多个领域。`,
      sources: items.map(item => item.source_url),
    };
  }
}

// 根据用户输入从可用分类中挑选相关分类
export async function classifyCategoriesFromInput(
  requirement: string,
  availableCategories: string[]
): Promise<string[]> {
  if (!requirement || !requirement.trim() || availableCategories.length === 0) {
    return [];
  }

  const categoryList = availableCategories.join('、');
  const systemPrompt = `你是一个资讯分类助手。系统将提供一个用户的简报需求描述，以及可供选择的资讯分类列表。你的任务是：
1. 仔细理解用户输入描述的关注重点。
2. 从提供的分类列表中选择所有有助于满足该需求的分类（可选择多个或全部）。
3. 如果用户需求比较泛泛或看不出明显倾向，也应选择所有与科技创业主题相关的分类，以确保覆盖面。
4. 严禁发明列表中不存在的分类。

返回格式必须是 JSON 数组，元素为所选分类的名称字符串。例如：["技术工具","前沿研究"]。不要输出额外文字。`;

  const userPrompt = `用户需求：${requirement.trim()}

可用分类（保持原文选择）：${categoryList}

请直接返回最合适的分类 JSON 数组。`;

  try {
    const response = await callSiliconFlow([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 0, 3, LLM_MODEL_CLASSIFY);

    const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/(\[[\s\S]*\])/);
    const target = jsonMatch ? jsonMatch[0] : cleaned;

    let parsed: unknown;
    try {
      parsed = JSON.parse(target);
    } catch (error) {
      // 尝试逗号或换行分隔的文本
      const fallbackList = cleaned
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
      parsed = fallbackList;
    }

    if (!Array.isArray(parsed)) {
      return [];
    }

    const availableSet = new Set(availableCategories);
    const result: string[] = [];
    for (const item of parsed) {
      if (typeof item === 'string' && availableSet.has(item) && !result.includes(item)) {
        result.push(item);
      }
    }
    return result;
  } catch (error) {
    console.error('Error classifying categories with LLM:', error);
    return [];
  }
}

