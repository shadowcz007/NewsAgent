import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware';
import { classifyCategoriesFromInput, generateBriefing } from '@/services/llm';
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
    
      let selectedCategories: string[] = [];
      try {
        selectedCategories = await classifyCategoriesFromInput(message, availableCategoryNames);
      } catch (classificationError) {
        console.error('Failed to classify categories for chat request:', classificationError);
      }
      console.log('selectedCategories', selectedCategories);
      if (selectedCategories.length === 0) {
        selectedCategories = availableCategoryNames;
      }

      const translatedItems = getTranslatedHotspotsByCategories(selectedCategories, 20);

      if (translatedItems.length === 0) {
        return NextResponse.json({
          response: '暂时没有匹配该需求的热点内容，请稍后再试。',
          sources: [],
          categories: selectedCategories,
        });
      }
      console.log('translatedItems', translatedItems);

      const result = await generateBriefing(translatedItems, message);

      return NextResponse.json({
        response: result.briefing,
        sources: result.sources,
        categories: selectedCategories,
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

