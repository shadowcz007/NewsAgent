import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware';
import { classifyCategoriesFromInput, generateBriefing, ClassificationResult } from '@/services/llm';
import { getAllCategories, getTranslatedHotspotsByCategories } from '@/services/briefing';

// 聊天接口（个性化查询）
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
        return NextResponse.json({
          response: '暂时没有匹配该需求的热点内容，请稍后再试。',
          sources: [],
          categories: selectedCategories,
          timeRange: classificationResult.timeRange,
          keywords: classificationResult.keywords,
        });
      }

      console.log('translatedItems count:', translatedItems.length);

      const result = await generateBriefing(translatedItems, message);

      return NextResponse.json({
        response: result.briefing,
        sources: result.sources,
        categories: selectedCategories,
        timeRange: classificationResult.timeRange,
        keywords: classificationResult.keywords,
      });
    } catch (error: any) {
      console.error('Error in chat:', error);
      return NextResponse.json(
        { error: 'Failed to process chat message', message: error.message },
        { status: 500 }
      );
    }
  });
}

