const axios = require('axios');

const PERPLEXITY_API_URL = 'https://api.perplexity.ai';
const API_KEY = process.env.PERPLEXITY_API_KEY;

/**
 * Sends a message to the Perplexity Chat Completions API and returns the response.
 * @param {Array} messages - An array of message objects following the OpenAI Chat API format.
 * @param {Object} options - Optional parameters for the API request.
 * @returns {Promise<Object>} - The API response data.
 */
async function getChatCompletion(messages, options = {}) {
  try {
    const response = await axios.post(
      PERPLEXITY_API_URL,
      {
        model: 'llama-3.1-sonar-small-128k-online', // Updated model name
        messages,
        max_tokens: options.max_tokens || 'Optional',
        temperature: options.temperature || 0.2,
        top_p: options.top_p || 0.9,
        return_citations: options.return_citations || true,
        search_domain_filter: options.search_domain_filter || ['perplexity.ai'],
        return_images: options.return_images || false,
        return_related_questions: options.return_related_questions || false,
        search_recency_filter: options.search_recency_filter || 'month',
        top_k: options.top_k || 0,
        stream: options.stream || false,
        presence_penalty: options.presence_penalty || 0,
        frequency_penalty: options.frequency_penalty || 1,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching chat completion:', error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = { getChatCompletion };