在 Chat 界面的回复里添加“收藏”功能（可以把回复的三段式统一保存起来）
收藏的简报在简报历史页面展示，点击可查看
收藏的简报，可以同步到 Notion / 飞书

---
简报需要取唯一的内容hash id，作为唯一的判断。

Notion API：
<notion_token>:ntn_Cn5385783644kLLDgnf3BNYZDFsVyg5xuh3yBfbHUeT2kC
<data_sources>:2ab0201a-0dbc-806f-8f14-000bf6f9de11

# 根据ID查询检索内容，得到 page id ，用于更新内容：
curl -X POST "https://api.notion.com/v1/data_sources/<data_sources>/query" \
  -H "Authorization: Bearer <notion_token>" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "property": "ID",
      "rich_text": {
        "equals": "11133"
      }
    }
  }'

响应：
{"object":"list","results":[{"object":"page","id":"2ab0201a-0dbc-80a4-acb5-ce6c7e13c174","created_time":"2025-11-14T02:24:00.000Z","last_edited_time":"2025-11-14T03:17:00.000Z","created_by":{"object":"user","id":"d0389ad2-6044-4be7-be5e-1c6707a56af3"},"last_edited_by":{"object":"user","id":"d0389ad2-6044-4be7-be5e-1c6707a56af3"},"cover":null,"icon":null,"parent":{"type":"data_source_id","data_source_id":"2ab0201a-0dbc-806f-8f14-000bf6f9de11","database_id":"2ab0201a-0dbc-80e8-9ded-d333c964d116"},"archived":false,"in_trash":false,"is_locked":false,"properties":{"Created time":{"id":"%3Fst%3B","type":"created_time","created_time":"2025-11-14T02:24:00.000Z"},"Content":{"id":"oq%5Ex","type":"rich_text","rich_text":[{"type":"text","text":{"content":"2222","link":null},"annotations":{"bold":false,"italic":false,"strikethrough":false,"underline":false,"code":false,"color":"default"},"plain_text":"2222","href":null}]},"ID":{"id":"vq%3CM","type":"rich_text","rich_text":[{"type":"text","text":{"content":"11133","link":null},"annotations":{"bold":false,"italic":false,"strikethrough":false,"underline":false,"code":false,"color":"default"},"plain_text":"11133","href":null}]},"Title":{"id":"title","type":"title","title":[{"type":"text","text":{"content":"测试新闻","link":null},"annotations":{"bold":false,"italic":false,"strikethrough":false,"underline":false,"code":false,"color":"default"},"plain_text":"测试新闻","href":null}]}},"url":"https://www.notion.so/2ab0201a0dbc80a4acb5ce6c7e13c174","public_url":null}],"next_cursor":null,"has_more":false,"type":"page_or_data_source","page_or_data_source":{},"request_id":"8cb25dad-c111-4b6d-ac61-1d0cb559246c"}

如果已经有page id了，则不新建内容，如果无，则新建内容；

# 新建内容：
<page_id>

curl -X POST "https://api.notion.com/v1/pages" \
  -H "Authorization: Bearer <notion_token>" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": {
      "type": "data_source_id",
      "data_source_id": <data_sources>
    },
    "properties": {
      "Title": {
        "title": [
          {
            "text": {
              "content": "新闻标题"
            }
          }
        ]
      },
      "Content": {
        "rich_text": [
          {
            "text": {
              "content": "内容描述"
            }
          }
        ]
      },
      "ID": {
        "rich_text": [
          {
            "text": {
              "content": "内容hash_id"
            }
          }
        ]
      }
    }
  }'


# 飞书API

curl 相关代码：

<folder_token> ：CF6jfWaXFlRCB4dJnBfciML5ned
<token>: u-fxhMoP9d97XbPJB9zhf8n94hmi6Nh0qpW0w0gh62abgA

# 创建新文档

curl -i -X POST 'https://open.feishu.cn/open-apis/docx/v1/documents' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer <token>' \
-d '{
"folder_token": <folder_token>,
"title": "一篇新的文档"
}’

响应；
{
  "code": 0,
  "data": {
    "document": {
      "document_id": "GHLZdYdh4ot2sQx9l6fciO0Pn8d",
      "revision_id": 1,
      "title": "一篇新的文档"
    }
  },
  "msg": "success"
}

# 获取文档所有块
<document_id> 从创建新文档的响应里获取。

curl -i -X GET ‘https://open.feishu.cn/open-apis/docx/v1/documents/<document_id>/blocks?document_revision_id=-1&page_size=500' \
-H 'Authorization: Bearer <token>'

响应：
{
  "code": 0,
  "data": {
    "has_more": false,
    "items": [
      {
        "block_id": "GHLZdYdh4ot2sQx9l6fciO0Pn8d",
        "block_type": 1,
        "children": [
          "AfH3dvhPPoYhmQxNlkgcWczJnPb"
        ],
        "page": {
          "elements": [
            {
              "text_run": {
                "content": "一篇新的文档",
                "text_element_style": {
                  "bold": false,
                  "inline_code": false,
                  "italic": false,
                  "strikethrough": false,
                  "underline": false
                }
              }
            }
          ],
          "style": {
            "align": 1
          }
        },
        "parent_id": ""
      },
      {
        "block_id": "AfH3dvhPPoYhmQxNlkgcWczJnPb",
        "block_type": 2,
        "parent_id": "GHLZdYdh4ot2sQx9l6fciO0Pn8d",
        "text": {
          "elements": [
            {
              "text_run": {
                "content": "",
                "text_element_style": {
                  "bold": false,
                  "inline_code": false,
                  "italic": false,
                  "strikethrough": false,
                  "underline": false
                }
              }
            }
          ],
          "style": {
            "align": 1,
            "folded": false
          }
        }
      }
    ]
  },
  "msg": "success"
}


# 创建块
<document_id> 从创建新文档的响应里获取；
<block_id> 从 获取文档所有块 的响应里得到。

curl -i -X POST 'https://open.feishu.cn/open-apis/docx/v1/documents/<document_id>/blocks/<block_id>/children?document_revision_id=-1' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer u-fxhMoP9d97XbPJB9zhf8n94hmi6Nh0qpW0w0gh62abgA' \
-d '{
"children": [{
"block_type": 2,
"text": {
"elements": [{
"text_run": {
"content": "多人实时协同，插入一切元素。不仅是在线文档，更是",
"text_element_style": {
"background_color": 14,
"text_color": 5
}}},
{
"text_run": {
"content": "强大的创作和互动工具",
"text_element_style": {
"background_color": 14,
"bold": true,
"text_color": 5
}}}],
"style": {}
}}],
"index": 0
}'
