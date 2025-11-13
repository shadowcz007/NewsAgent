import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware';
import { classifyCategoriesFromInput, generateBriefingStream, ClassificationResult } from '@/services/llm';
import { getAllCategories, getTranslatedHotspotsByCategories } from '@/services/briefing';

// 聊天接口（个性化查询）- SSE流式输出
export async function POST(request: NextRequest) {
  return withApiKeyAuth(request, async (req, userId) => {
    const body = await request.json();
    const { message, context } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    try {
      const categoryRecords = getAllCategories();
      const availableCategoryNames = categoryRecords.map((item) => item.name);
    
      let classificationResult: ClassificationResult;
      try {
        classificationResult = await classifyCategoriesFromInput(message, availableCategoryNames);
      } catch (classificationError) {
        console.error('Failed to classify categories for chat request:', classificationError);
        // 兜底逻辑：查询最近1天的新信息，不限制分类
        classificationResult = {
          categories: [],
          timeRange: 1,
          keywords: [],
        };
      }

      // 如果分类为空，使用所有分类
      const selectedCategories = classificationResult.categories.length > 0 
        ? classificationResult.categories 
        : [];

      console.log('Classification result:', {
        categories: selectedCategories,
        timeRange: classificationResult.timeRange,
        keywords: classificationResult.keywords,
      });

      const translatedItems = getTranslatedHotspotsByCategories(
        selectedCategories,
        30,
        classificationResult.timeRange,
        classificationResult.keywords
      );

      if (translatedItems.length === 0) {
        // 对于空结果，也使用SSE格式返回
        const stream = new ReadableStream({
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
              timeRange: classificationResult.timeRange,
              keywords: classificationResult.keywords,
            });
            controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
            controller.close();
          },
        });

        return new NextResponse(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }

      console.log('translatedItems count:', translatedItems.length);

      // 创建SSE流式响应
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
          try {
            // 流式生成简报
            for await (const chunk of generateBriefingStream(translatedItems, message)) {
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
                  timeRange: classificationResult.timeRange,
                  keywords: classificationResult.keywords,
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

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
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

