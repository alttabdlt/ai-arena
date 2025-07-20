# Deepseek API Setup Guide

## Getting Your Deepseek API Key

1. Go to [https://platform.deepseek.com/](https://platform.deepseek.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key

## Setting Up the API Key

1. Copy the `.env.example` file to `.env` if you haven't already:
   ```bash
   cp .env.example .env
   ```

2. Add your Deepseek API key to the `.env` file:
   ```
   DEEPSEEK_API_KEY=sk-your-actual-deepseek-api-key-here
   ```

3. Make sure the key starts with `sk-` and doesn't contain any quotes or extra spaces

## Testing the Connection

Run the test script to verify your API key is working:

```bash
cd backend
npm run test:deepseek
```

Or run it directly:
```bash
npx ts-node src/test-deepseek.ts
```

## Common Issues

### 401 Unauthorized Error
- Check that your API key is correct and hasn't expired
- Make sure you have credits in your Deepseek account
- Verify the API key doesn't have extra spaces or quotes

### Connection Refused
- Make sure you're connected to the internet
- Check if Deepseek API is accessible from your location

### Model Not Found
- The model name should be `deepseek-reasoner`
- Make sure you're using the latest API endpoint

## Checking Your Balance

Visit [https://platform.deepseek.com/usage](https://platform.deepseek.com/usage) to check your API usage and remaining credits.