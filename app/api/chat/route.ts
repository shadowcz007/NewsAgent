import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware';
import { classifyCategoriesFromInput, generateBriefingStream, generateBriefing, ClassificationResult } from '@/services/llm';
import { getAllCategories, getTranslatedHotspotsByCategories } from '@/services/briefing';
import { retrieveKnowledge } from '@/services/dify';

// 聊天接口（个性化查询）- 支持流式和非流式输出
export async function POST(request: NextRequest) {
  return withApiKeyAuth(request, async (req, userId) => {
    const body = await request.json();
    const { message, context, stream = false } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    try {
      const categoryRecords = getAllCategories();
      const availableCategoryNames = categoryRecords.map((item) => item.name);
    
      // 并发执行：分类和知识检索同时进行
      const [classificationResult, historicalKnowledge] = await Promise.allSettled([
        classifyCategoriesFromInput(message, availableCategoryNames).catch((error) => {
          console.error('Failed to classify categories for chat request:', error);
          // 兜底逻辑：查询最近1天的新信息，不限制分类
          return {
            categories: [],
            timeRange: 1,
            keywords: [],
          } as ClassificationResult;
        }),
        retrieveKnowledge(message, 2).catch((error) => {
          console.error('Failed to retrieve knowledge from Dify:', error);
          // 容错：返回空数组，不影响简报生成
          return [];
        }),
      ]);

      // 处理分类结果
      const finalClassificationResult: ClassificationResult = 
        classificationResult.status === 'fulfilled' 
          ? classificationResult.value 
          : {
              categories: [],
              timeRange: 1,
              keywords: [],
            };

      // 处理知识检索结果
      const finalHistoricalKnowledge = 
        historicalKnowledge.status === 'fulfilled' 
          ? historicalKnowledge.value 
          : [];

      // 如果分类为空，使用所有分类
      const selectedCategories = finalClassificationResult.categories.length > 0 
        ? finalClassificationResult.categories 
        : [];

      console.log('Classification result:', {
        categories: selectedCategories,
        timeRange: finalClassificationResult.timeRange,
        keywords: finalClassificationResult.keywords,
      });

      console.log('Historical knowledge retrieved:', finalHistoricalKnowledge.length, 'items');

      const translatedItems = getTranslatedHotspotsByCategories(
        selectedCategories,
        30,
        finalClassificationResult.timeRange,
        finalClassificationResult.keywords
      );

      console.log('translatedItems count:', translatedItems.length);

      // 根据stream参数决定返回格式
      if (stream) {
        // 流式响应（SSE）
        if (translatedItems.length === 0) {
          // 对于空结果，使用SSE格式返回
          const streamResponse = new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();
              const data = JSON.stringify({
                type: 'content',
                text: '暂时没有匹配该需求的热点内容，请稍后再试。'
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              
              const doneData = JSON.stringify({
                type: 'done',
                sources: [],
                categories: selectedCategories,
                timeRange: finalClassificationResult.timeRange,
                keywords: finalClassificationResult.keywords,
              });
              controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
              controller.close();
            },
          });

          return new NextResponse(streamResponse, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        }

        // 创建SSE流式响应
        const streamResponse = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            
            try {
              // 流式生成简报（传入历史知识）
              for await (const chunk of generateBriefingStream(translatedItems, message, finalHistoricalKnowledge)) {
                if (chunk.type === 'content' && chunk.text) {
                  const data = JSON.stringify({
                    type: 'content',
                    text: chunk.text,
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } else if (chunk.type === 'done') {
                  const data = JSON.stringify({
                    type: 'done',
                    sources: chunk.sources || [],
                    categories: selectedCategories,
                    timeRange: finalClassificationResult.timeRange,
                    keywords: finalClassificationResult.keywords,
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  controller.close();
                  return;
                }
              }
            } catch (error: any) {
              console.error('Error in stream:', error);
              const errorData = JSON.stringify({
                type: 'error',
                message: error.message || 'Failed to process chat message',
              });
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
              controller.close();
            }
          },
        });

        return new NextResponse(streamResponse, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        // 非流式响应（JSON）
        if (translatedItems.length === 0) {
          return NextResponse.json({
            briefing: '暂时没有匹配该需求的热点内容，请稍后再试。',
            sources: [],
            categories: selectedCategories,
            timeRange: finalClassificationResult.timeRange,
            keywords: finalClassificationResult.keywords,
          });
        }

        // 非流式生成简报（传入历史知识）
        const { briefing, sources } = await generateBriefing(translatedItems, message, finalHistoricalKnowledge);
        
        return NextResponse.json({
          briefing,
          sources,
          categories: selectedCategories,
          timeRange: finalClassificationResult.timeRange,
          keywords: finalClassificationResult.keywords,
        });
      }
    } catch (error: any) {
      console.error('Error in chat:', error);
      // 对于非流式错误，返回JSON响应
      return NextResponse.json(
        { error: 'Failed to process chat message', message: error.message },
        { status: 500 }
      );
    }
  });
}

