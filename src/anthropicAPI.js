const { Anthropic } = require('@anthropic-ai/sdk');

// Replace with your API key, preferably use environment variables
const API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Sends a message to the Anthropic Claude API using the Messages API and returns the response.
 * @param {Array} messages - The conversation history to send to the Claude API.
 * @returns {Promise<string>} - The API response data.
 */
async function getClaudeCompletion(messages) {
  try {
    const client = new Anthropic({
      apiKey: API_KEY,
    });

    // Format the messages according to the API requirements
    const formattedMessages = messages.map(msg => {
      if (msg.role === 'user') {
        return { role: 'user', content: msg.content };
      } else if (msg.role === 'assistant') {
        return { role: 'assistant', content: msg.content };
      }
    });

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20240620', // Using Claude Sonnet 3.5
      messages: formattedMessages,
      max_tokens: 1000,
    });

    return response.data.completion;
  } catch (error) {
    console.error('Error fetching Claude completion:', error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = { getClaudeCompletion };
