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

// 分类结果数据结构
export interface ClassificationResult {
  categories: string[];
  timeRange: number | null;
  keywords: string[];
}

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
3. **结构化输出**：严格输出一个标准 JSON 数组，遵循以下规则：
  * 必须使用标准英文标点符号：逗号 (,)、冒号 (:)、引号 (")
  * **严禁**使用任何中文标点符号：、，：""''（）【】等
  * 每个对象包含且仅包含三个键：\`"translated_title"\`、\`"source_url"\`、\`"category"\`
  * 所有字符串值必须用双引号包裹，不能包含未转义的换行符或特殊字符
  * **不要**添加任何解释、说明、Markdown 代码块标记（如 \`\`\`json）或注释
  * 直接输出纯 JSON 数组，格式示例：
    [{"translated_title":"标题","source_url":"https://...","category":"技术工具"}]`;

// 个性化输出简报的 System Prompt
const BRIEFING_PROMPT = `你是一个敏锐的 AI 创业观察者，以「创业者日记」的口吻处理输入的资讯条目列表（每个条目含 \`"translated_title"\`、\`"source_url"\`、\`"category"\`）。  

**默认行为（用户未提供额外要求时）**：  
- 用不超过 140 字提炼所有条目的**共同洞察**，而非罗列事实。  
- 聚焦三件事：**谁在解决什么真问题？为何此刻重要？隐含何种范式转移？**  
- 优先捕捉具备**自然语言界面、氛围编程（Vibe Coding）或 AI Agent 协作潜力**的信号。  
- 语气带判断、有情绪，像你真的会记在备忘录里的那句话。  

**若用户提供了自定义要求**：  
- 严格按用户要求处理输入的资讯条目列表，生成 140 字内简报，仍保持精炼、洞察导向、拒绝泛泛而谈。  

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

// 流式调用硅基流动 API
export async function* callSiliconFlowStream(
  messages: Array<{ role: string; content: string }>,
  model: string = SILICONFLOW_MODEL
): AsyncGenerator<string, void, unknown> {
  try {
    const response = await axios.post(
      SILICONFLOW_API_URL,
      {
        model: model,
        messages,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${SILICONFLOW_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
      }
    );

    const stream = response.data;
    let buffer = '';

    // 将Node.js流转换为异步迭代器
    for await (const chunk of stream) {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '') continue;
        
        if (trimmedLine.startsWith('data: ')) {
          const dataStr = trimmedLine.slice(6).trim();
          if (dataStr === '[DONE]') {
            return;
          }
          if (dataStr === '') continue;
          
          try {
            const data = JSON.parse(dataStr);
            if (data.choices && data.choices[0] && data.choices[0].delta) {
              const content = data.choices[0].delta.content;
              if (content) {
                yield content;
              }
            }
          } catch (e) {
            // 忽略解析错误，继续处理下一行
            console.error('Error parsing SSE data:', e, 'Data:', dataStr);
          }
        }
      }
    }

    // 处理剩余的buffer
    if (buffer.trim()) {
      const trimmedBuffer = buffer.trim();
      if (trimmedBuffer.startsWith('data: ')) {
        const dataStr = trimmedBuffer.slice(6).trim();
        if (dataStr !== '[DONE]' && dataStr !== '') {
          try {
            const data = JSON.parse(dataStr);
            if (data.choices && data.choices[0] && data.choices[0].delta) {
              const content = data.choices[0].delta.content;
              if (content) {
                yield content;
              }
            }
          } catch (e) {
            // 忽略解析错误
            console.error('Error parsing final buffer:', e);
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Error calling SiliconFlow API stream:', error);
    throw new Error(`LLM API stream error: ${error.message}`);
  }
}

/**
 * 辅助函数：修复常见的 JSON 格式问题
 * 处理尾随逗号、未转义字符、中文标点等常见错误
 */
function fixCommonJsonIssues(jsonStr: string): string {
  // 0. 先修复中文标点符号（在 JSON 结构外的）
  // 这一步要在状态机处理之前完成，避免字符串内的中文标点被误改
  jsonStr = replaceCJKPunctuation(jsonStr);
  
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
  
  // 4. 修复缺失的对象间逗号（两个连续的 } 后跟 {）
  result = result.replace(/}(\s*){/g, '},\n{');
  
  return result;
}

/**
 * 辅助函数：替换中文标点符号为英文标点
 * 仅在 JSON 结构位置（非字符串值内）替换
 */
function replaceCJKPunctuation(text: string): string {
  // 使用状态机方式，只在非字符串区域替换中文标点
  let result = '';
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escapeNext = true;
      result += char;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    
    // 在非字符串区域，替换中文标点
    if (!inString) {
      switch (char) {
        case '，': result += ','; break;  // 中文逗号 → 英文逗号
        case '、': result += ','; break;  // 中文顿号 → 英文逗号
        case '：': result += ':'; break;  // 中文冒号 → 英文冒号
        case '；': result += ';'; break;  // 中文分号 → 英文分号
        case '（': result += '('; break;  // 中文左括号 → 英文左括号
        case '）': result += ')'; break;  // 中文右括号 → 英文右括号
        case '【': result += '['; break;  // 中文左方括号 → 英文左方括号
        case '】': result += ']'; break;  // 中文右方括号 → 英文右方括号
        case '｛': result += '{'; break;  // 全角左花括号 → 英文左花括号
        case '｝': result += '}'; break;  // 全角右花括号 → 英文右花括号
        case '“': result += '"'; break;  // 中文左双引号 → 英文双引号
        case '”': result += '"'; break;  // 中文右双引号 → 英文双引号
        case "‘": result += "'"; break;  // 中文左单引号 → 英文单引号
        case '’': result += "'"; break;  // 中文右单引号 → 英文单引号
        default: result += char; break;
      }
    } else {
      result += char;
    }
  }
  
  return result;
}

/**
 * 辅助函数：提取 JSON 解析错误的详细信息
 */
function extractParseErrorDetails(error: any, processedString: string): string {
  let details = '';
  
  // 错误类型
  details += `\n  错误类型: ${error.name || 'Unknown'}`;
  
  // 错误信息
  details += `\n  错误信息: ${error.message || 'No message'}`;
  
  // 如果是语法错误，尝试提取错误位置
  if (error instanceof SyntaxError) {
    // 尝试从错误信息中提取位置
    const positionMatch = error.message.match(/position (\d+)/i);
    if (positionMatch) {
      const pos = parseInt(positionMatch[1]);
      const start = Math.max(0, pos - 50);
      const end = Math.min(processedString.length, pos + 50);
      const snippet = processedString.substring(start, end);
      details += `\n  错误位置: ${pos}`;
      details += `\n  错误片段: ...${snippet}...`;
    } else {
      // 如果无法从错误信息中提取位置，显示前 100 个字符
      const snippet = processedString.substring(0, 100);
      details += `\n  处理后字符串前100字符: ${snippet}${processedString.length > 100 ? '...' : ''}`;
    }
  } else {
    // 非语法错误，显示处理后字符串的摘要
    const snippet = processedString.substring(0, 100);
    details += `\n  处理后字符串前100字符: ${snippet}${processedString.length > 100 ? '...' : ''}`;
  }
  
  return details;
}

/**
 * 辅助函数：多策略 JSON 解析
 * 依次尝试 10 种不同的解析策略，提高成功率
 */
function parseJsonResponse(response: string, batchNumber: number): TranslatedItem[] {
  // 每个策略返回 [处理后的字符串, 解析结果] 元组，用于错误诊断
  const strategies: Array<() => [string, any]> = [
    // 策略 1: 直接解析
    () => {
      console.log(`第 ${batchNumber} 批：尝试策略 1 - 直接解析`);
      return [response, JSON.parse(response)];
    },
    
    // 策略 2: 移除 markdown 代码块后解析
    () => {
      console.log(`第 ${batchNumber} 批：尝试策略 2 - 移除 markdown 代码块`);
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return [cleaned, JSON.parse(cleaned)];
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
      return [jsonStr, JSON.parse(jsonStr)];
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
      return [fixed, JSON.parse(fixed)];
    },
    
    // 策略 5: 提取最大的 JSON 结构
    () => {
      console.log(`第 ${batchNumber} 批：尝试策略 5 - 提取最大 JSON 结构`);
      // 查找所有可能的 JSON 数组
      const arrayMatches = response.matchAll(/\[[\s\S]*?\]/g);
      let longestMatch = '';
      let longestFixed = '';
      
      for (const match of arrayMatches) {
        if (match[0].length > longestMatch.length) {
          try {
            const fixed = fixCommonJsonIssues(match[0]);
            JSON.parse(fixed); // 测试是否有效
            longestMatch = match[0];
            longestFixed = fixed;
          } catch (e) {
            // 继续尝试下一个
          }
        }
      }
      
      if (longestMatch) {
        return [longestFixed, JSON.parse(longestFixed)];
      }
      
      throw new Error('No valid JSON array found');
    },
    
    // 策略 6: 中文标点修复后解析
    () => {
      console.log(`第 ${batchNumber} 批：尝试策略 6 - 中文标点修复后解析`);
      let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      // 提取 JSON 结构
      const startArray = cleaned.indexOf('[');
      const endArray = cleaned.lastIndexOf(']');
      if (startArray !== -1 && endArray !== -1) {
        cleaned = cleaned.substring(startArray, endArray + 1);
      }
      
      // 应用中文标点修复和其他修复
      const fixed = fixCommonJsonIssues(cleaned);
      return [fixed, JSON.parse(fixed)];
    },
    
    // 策略 7: 贪婪数组提取（使用贪婪模式）
    () => {
      console.log(`第 ${batchNumber} 批：尝试策略 7 - 贪婪数组提取`);
      // 使用贪婪模式匹配最长的数组结构
      const greedyMatch = response.match(/\[[\s\S]*\]/);
      if (!greedyMatch) {
        throw new Error('No array structure found with greedy match');
      }
      
      const fixed = fixCommonJsonIssues(greedyMatch[0]);
      return [fixed, JSON.parse(fixed)];
    },
    
    // 策略 8: 逐对象容错解析
    () => {
      console.log(`第 ${batchNumber} 批：尝试策略 8 - 逐对象容错解析`);
      // 先修复中文标点，然后使用正则匹配所有可能的对象（包括跨行）
      const cleaned = fixCommonJsonIssues(response);
      
      // 使用更宽松的正则匹配对象，允许跨行和更多空白字符
      const objectPattern = /\{[\s\S]*?"translated_title"[\s\S]*?"source_url"[\s\S]*?"category"[\s\S]*?\}/g;
      const objectMatches = cleaned.match(objectPattern);
      
      if (!objectMatches || objectMatches.length === 0) {
        throw new Error('No valid objects found');
      }
      
      const parsedObjects: TranslatedItem[] = [];
      let processedArray = '[';
      for (const objStr of objectMatches) {
        try {
          // 对于每个对象，再做一次清理（移除对象内多余的空白行）
          const cleanedObj = objStr.replace(/\n\s*\n/g, '\n');
          const parsed = JSON.parse(cleanedObj);
          if (parsed.translated_title && parsed.source_url && parsed.category) {
            parsedObjects.push(parsed);
            processedArray += cleanedObj + ',';
          }
        } catch (e) {
          // 跳过损坏的对象，继续处理下一个
          console.log(`第 ${batchNumber} 批：策略 8 - 跳过一个损坏的对象: ${(e as Error).message}`);
        }
      }
      
      if (parsedObjects.length === 0) {
        throw new Error('No valid objects could be parsed');
      }
      
      processedArray = processedArray.slice(0, -1) + ']'; // 移除最后的逗号并关闭数组
      return [processedArray, parsedObjects];
    },
    
    // 策略 9: 字段级重建
    () => {
      console.log(`第 ${batchNumber} 批：尝试策略 9 - 字段级重建`);
      // 先修复中文标点
      const cleaned = fixCommonJsonIssues(response);
      
      // 使用正则提取所有字段，支持更多变体
      const titlePattern = /"translated_title"\s*:\s*"([^"]+)"/g;
      const urlPattern = /"source_url"\s*:\s*"([^"]+)"/g;
      const categoryPattern = /"category"\s*:\s*"([^"]+)"/g;
      
      const titles = Array.from(cleaned.matchAll(titlePattern), m => m[1]);
      const urls = Array.from(cleaned.matchAll(urlPattern), m => m[1]);
      const categories = Array.from(cleaned.matchAll(categoryPattern), m => m[1]);
      
      if (titles.length === 0 || urls.length === 0 || categories.length === 0) {
        throw new Error('Could not extract required fields');
      }
      
      // 取最小长度，确保所有对象都有完整字段
      const minLength = Math.min(titles.length, urls.length, categories.length);
      const reconstructed: TranslatedItem[] = [];
      
      for (let i = 0; i < minLength; i++) {
        reconstructed.push({
          translated_title: titles[i],
          source_url: urls[i],
          category: categories[i] as TranslatedItem['category'],
        });
      }
      
      if (reconstructed.length === 0) {
        throw new Error('Could not reconstruct any objects');
      }
      
      const processedStr = JSON.stringify(reconstructed);
      return [processedStr, reconstructed];
    },
    
    // 策略 10: 增强字段级重建（处理多行字段值）
    () => {
      console.log(`第 ${batchNumber} 批：尝试策略 10 - 增强字段级重建`);
      // 处理可能跨行的字段值
      const titlePattern = /"translated_title"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/g;
      const urlPattern = /"source_url"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/g;
      const categoryPattern = /"category"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/g;
      
      const titles = Array.from(response.matchAll(titlePattern), m => m[1]);
      const urls = Array.from(response.matchAll(urlPattern), m => m[1]);
      const categories = Array.from(response.matchAll(categoryPattern), m => m[1]);
      
      if (titles.length === 0 && urls.length === 0) {
        throw new Error('Could not extract any fields');
      }
      
      // 尝试按对象分组重建
      const reconstructed: TranslatedItem[] = [];
      const minLength = Math.min(titles.length, urls.length, categories.length);
      
      for (let i = 0; i < minLength; i++) {
        // 验证 URL 是否有效
        if (urls[i] && (urls[i].startsWith('http://') || urls[i].startsWith('https://'))) {
          reconstructed.push({
            translated_title: titles[i] || '未命名',
            source_url: urls[i],
            category: (categories[i] as TranslatedItem['category']) || '其他',
          });
        }
      }
      
      if (reconstructed.length === 0) {
        throw new Error('Could not reconstruct any valid objects');
      }
      
      const processedStr = JSON.stringify(reconstructed);
      return [processedStr, reconstructed];
    },
  ];
  
  // 依次尝试每个策略
  let lastError: any = null;
  let lastProcessedString: string = '';
  
  for (let i = 0; i < strategies.length; i++) {
    try {
      const [processedString, result] = strategies[i]();
      lastProcessedString = processedString;
      
      console.log(`第 ${batchNumber} 批：策略 ${i + 1} 成功解析`);
      
      // 验证结果是数组
      if (!Array.isArray(result)) {
        throw new Error('Parsed result is not an array');
      }
      
      return result as TranslatedItem[];
    } catch (error: any) {
      lastError = error;
      
      // 增强的诊断日志
      console.log(`第 ${batchNumber} 批：策略 ${i + 1} 失败`);
      
      // 如果有处理后的字符串，提取详细错误信息
      if (lastProcessedString) {
        const errorDetails = extractParseErrorDetails(error, lastProcessedString);
        console.log(errorDetails);
      } else {
        // 没有处理后的字符串，直接显示错误信息
        console.log(`  错误类型: ${error.name || 'Unknown'}`);
        console.log(`  错误信息: ${error.message || 'No message'}`);
      }
      
      // 重置处理字符串，准备下一个策略
      lastProcessedString = '';
    }
  }
  
  // 所有策略都失败，输出详细诊断信息
  console.log(`\n第 ${batchNumber} 批：所有 ${strategies.length} 个策略均失败`);
  console.log(`原始响应长度: ${response.length} 字符`);
  console.log(`原始响应前 300 字符:\n${response.substring(0, 300)}${response.length > 300 ? '...' : ''}`);
  
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

// 流式生成个性化简报
export async function* generateBriefingStream(
  items: TranslatedItem[],
  customRequirement?: string
): AsyncGenerator<{ type: 'content' | 'done'; text?: string; sources?: string[] }, void, unknown> {
  if (items.length === 0) {
    yield { type: 'content', text: '暂无热点资讯' };
    yield { type: 'done', sources: [] };
    return;
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
    let fullResponse = '';
    
    // 流式获取响应
    for await (const chunk of callSiliconFlowStream(messages, LLM_MODEL_BRIEFING)) {
      fullResponse += chunk;
      yield { type: 'content', text: chunk };
    }

    // 解析两段格式提取来源
    const parts = fullResponse.split('\n\n');
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

    // 如果没有提取到sources，使用所有items的source_url作为后备
    if (sources.length === 0) {
      sources.push(...items.map(item => item.source_url));
    }

    yield { type: 'done', sources };
  } catch (error: any) {
    console.error('Error in generateBriefingStream:', error);
    // 返回错误信息
    yield { type: 'content', text: `今日共收集 ${items.length} 条热点资讯，涵盖多个领域。` };
    yield { type: 'done', sources: items.map(item => item.source_url) };
  }
}

/**
 * 解析分类结果 JSON 对象（复用现有 JSON 解析逻辑）
 * 支持多种容错策略，处理 markdown、中文标点等问题
 */
function parseClassificationResult(response: string): ClassificationResult {
  const strategies: Array<() => [string, any]> = [
    // 策略 1: 直接解析
    () => {
      return [response, JSON.parse(response)];
    },
    
    // 策略 2: 移除 markdown 代码块后解析
    () => {
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return [cleaned, JSON.parse(cleaned)];
    },
    
    // 策略 3: 使用正则提取 JSON 对象并修复常见问题
    () => {
      let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      // 尝试找到第一个 { 到最后一个 }
      const startObject = cleaned.indexOf('{');
      const endObject = cleaned.lastIndexOf('}');
      
      if (startObject === -1 || endObject === -1 || startObject >= endObject) {
        throw new Error('No valid JSON object structure found');
      }
      
      const jsonStr = cleaned.substring(startObject, endObject + 1);
      const fixed = fixCommonJsonIssues(jsonStr);
      return [fixed, JSON.parse(fixed)];
    },
    
    // 策略 4: 逐行清理后解析
    () => {
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
      return [fixed, JSON.parse(fixed)];
    },
    
    // 策略 5: 贪婪对象提取
    () => {
      const greedyMatch = response.match(/\{[\s\S]*\}/);
      if (!greedyMatch) {
        throw new Error('No object structure found with greedy match');
      }
      const fixed = fixCommonJsonIssues(greedyMatch[0]);
      return [fixed, JSON.parse(fixed)];
    },
    
    // 策略 6: 字段级重建
    () => {
      const cleaned = fixCommonJsonIssues(response);
      
      // 提取各个字段
      const categoriesMatch = cleaned.match(/"categories"\s*:\s*(\[[\s\S]*?\])/);
      const timeRangeMatch = cleaned.match(/"timeRange"\s*:\s*(\d+|null)/);
      const keywordsMatch = cleaned.match(/"keywords"\s*:\s*(\[[\s\S]*?\])/);
      
      const result: any = {
        categories: categoriesMatch ? JSON.parse(categoriesMatch[1]) : [],
        timeRange: timeRangeMatch ? (timeRangeMatch[1] === 'null' ? null : parseInt(timeRangeMatch[1])) : null,
        keywords: keywordsMatch ? JSON.parse(keywordsMatch[1]) : [],
      };
      
      const processedStr = JSON.stringify(result);
      return [processedStr, result];
    },
  ];
  
  // 依次尝试每个策略
  let lastError: any = null;
  
  for (let i = 0; i < strategies.length; i++) {
    try {
      const [processedString, result] = strategies[i]();
      
      // 验证结果是对象
      if (typeof result !== 'object' || result === null || Array.isArray(result)) {
        throw new Error('Parsed result is not an object');
      }
      
      // 验证必需字段
      if (!Array.isArray(result.categories)) {
        throw new Error('categories field is missing or not an array');
      }
      
      return {
        categories: Array.isArray(result.categories) ? result.categories : [],
        timeRange: typeof result.timeRange === 'number' ? result.timeRange : (result.timeRange === null ? null : null),
        keywords: Array.isArray(result.keywords) ? result.keywords : [],
      };
    } catch (error: any) {
      lastError = error;
      console.log(`分类结果解析策略 ${i + 1} 失败: ${error.message}`);
    }
  }
  
  // 所有策略都失败
  throw new Error(`所有解析策略都失败。最后错误: ${lastError?.message || 'Unknown'}`);
}

// 根据用户输入从可用分类中挑选相关分类，并提取时间范围和关键词
export async function classifyCategoriesFromInput(
  requirement: string,
  availableCategories: string[]
): Promise<ClassificationResult> {
  if (!requirement || !requirement.trim() || availableCategories.length === 0) {
    return {
      categories: [],
      timeRange: null,
      keywords: [],
    };
  }

  const categoryList = availableCategories.join('、');
  const systemPrompt = `你是一个资讯分类和检索助手。系统将提供一个用户的简报需求描述，以及可供选择的资讯分类列表。你的任务是：

1. **分类识别**：从提供的分类列表中选择所有有助于满足该需求的分类（可选择多个或全部）。如果用户需求比较泛泛或看不出明显倾向，也应选择所有与科技创业主题相关的分类，以确保覆盖面。严禁发明列表中不存在的分类。

2. **时间范围识别**：根据用户输入判断时间范围需求。如果用户提到"最近1天"、"今天"、"今日"等，返回1；如果提到"最近3天"、"近三天"等，返回3；如果提到"最近7天"、"本周"、"近一周"等，返回7；如果提到"最近30天"、"本月"、"近一个月"等，返回30；如果用户没有明确时间要求，返回null。

3. **关键词提取**：从用户输入中提取检索命名实体词，并**自动生成尽可能多的同义词、中英文、缩写等变体**，以提高搜索引擎检索覆盖率。这些关键词将用于 SQL LIKE 模糊搜索（OR 逻辑），因此变体越多，检索覆盖率越高。

**生成规则**：
- 为每个核心概念生成尽可能多的相关词汇变体
- 包含同义词、近义词、相关术语
- 包含中英文对照（如：AI / 人工智能 / artificial intelligence）
- 包含缩写和全称（如：LLM / 大语言模型 / Large Language Model）
- 包含大小写变体（如：AI / ai / Ai）
- 包含常见行业术语和表达方式
- 包含相关概念扩展（如：AI 可扩展为：机器学习、深度学习、神经网络等）

**示例**：
- AI 相关：["AI", "ai", "Ai", "人工智能", "智能", "artificial intelligence", "Artificial Intelligence", "机器学习", "machine learning", "ML", "深度学习", "deep learning", "神经网络", "neural network"]
- API 相关：["API", "api", "接口", "应用程序接口", "application programming interface", "Application Programming Interface", "REST API", "GraphQL", "Web API"]
- LLM 相关：["LLM", "llm", "大语言模型", "大模型", "Large Language Model", "语言模型", "language model", "GPT", "ChatGPT", "生成式AI", "generative AI"]

命名实体词应该是有助于检索相关资讯的核心词汇。

返回格式必须是 JSON 对象，包含三个字段：
- categories: 字符串数组，所选分类的名称
- timeRange: 数字（1、3、7、30等）或null，表示时间范围（天数）
- keywords: 字符串数组，检索关键词列表（**必须包含尽可能多的同义词、中英文、缩写等变体**）

示例：{"categories":["技术工具","前沿研究"],"timeRange":3,"keywords":["AI","ai","Ai","人工智能","智能","artificial intelligence","Artificial Intelligence","机器学习","machine learning","ML","LLM","llm","大语言模型","大模型","Large Language Model"]}

不要输出额外文字，只返回JSON对象。`;

  const userPrompt = `用户需求：${requirement.trim()}

可用分类（保持原文选择）：${categoryList}

请分析用户需求，返回包含分类、时间范围和关键词的JSON对象。`;

  try {
    const response = await callSiliconFlow([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 0, 3, LLM_MODEL_CLASSIFY);

    // 使用容错解析函数
    const parsed = parseClassificationResult(response);

    // 验证和过滤分类
    const availableSet = new Set(availableCategories);
    const validCategories: string[] = [];
    for (const item of parsed.categories) {
      if (typeof item === 'string' && availableSet.has(item) && !validCategories.includes(item)) {
        validCategories.push(item);
      }
    }

    // 验证时间范围
    let validTimeRange: number | null = null;
    if (parsed.timeRange !== null && typeof parsed.timeRange === 'number' && parsed.timeRange > 0) {
      validTimeRange = parsed.timeRange;
    }

    // 验证和清理关键词
    const validKeywords: string[] = [];
    if (Array.isArray(parsed.keywords)) {
      for (const keyword of parsed.keywords) {
        if (typeof keyword === 'string' && keyword.trim()) {
          const trimmed = keyword.trim();
          if (!validKeywords.includes(trimmed)) {
            validKeywords.push(trimmed);
          }
        }
      }
    }

    return {
      categories: validCategories,
      timeRange: validTimeRange,
      keywords: validKeywords,
    };
  } catch (error) {
    console.error('Error classifying categories with LLM:', error);
    // 解析失败时抛出错误，由调用方处理兜底逻辑
    throw error;
  }
}

