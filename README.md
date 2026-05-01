# Playwright Notion Reporter

> Playwright のテスト結果を Notion に記録する GitHub Action

## 使い方

```yaml
- uses: su6y/playwright-notion-reporter@v1
  with:
    notion-token: ${{ secrets.NOTION_TOKEN }}
    database-id: ${{ secrets.NOTION_DATABASE_ID }}
```

### 全オプション指定

```yaml
- uses: su6y/playwright-notion-reporter@v1
  with:
    notion-token: ${{ secrets.NOTION_TOKEN }}
    database-id: ${{ secrets.NOTION_DATABASE_ID }}
    report-path: playwright-report/results.json
    product: web-app
    test-type: e2e
```

## ライセンス

[MIT](LICENSE) © [su6y](https://github.com/su6y)
