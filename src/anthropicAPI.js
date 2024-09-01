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
    const formattedMessages = [];
    let lastRole = null;

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Add system message at the beginning
        if (formattedMessages.length === 0) {
          formattedMessages.push({ role: 'system', content: msg.content });
        }
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        if (msg.role !== lastRole) {
          formattedMessages.push({ role: msg.role, content: msg.content });
          lastRole = msg.role;
        } else if (msg.role === 'user') {
          // Combine consecutive user messages
          formattedMessages[formattedMessages.length - 1].content += '\n' + msg.content;
        }
      }
    }

    // Ensure the last message is from the user
    if (formattedMessages[formattedMessages.length - 1].role !== 'user') {
      formattedMessages.pop();
    }

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      messages: formattedMessages,
      max_tokens: 1000,
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Error fetching Claude completion:', error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = { getClaudeCompletion };
