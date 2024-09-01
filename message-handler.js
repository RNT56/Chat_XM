export class MessageHandler {
  constructor(chatProcessor, saveChatHistoryCallback) {
    this.chatProcessor = chatProcessor;
    this.saveChatHistory = saveChatHistoryCallback;
    this.currentChatId = null;
    this.initializeWebSearchToggle();
    this.loadingExistingChat = false;
  }

  async sendMessage(model, input, outputFormat) {
    const useWebSearch = document.getElementById('webSearchToggle').classList.contains('enabled');
    const userInput = input.trim();
    if (userInput === '') return false;

    const chatHistory = document.getElementById('chat-history');
    const userMessageId = this.generateUniqueId();
    const userMessage = this.createMessageElement('user', userInput, outputFormat, this.currentChatId, userMessageId);
    chatHistory.appendChild(userMessage);

    document.getElementById('user-input').value = '';

    this.showTypingIndicator();

    try {
      const response = await window.api.sendMessage(model, userInput, outputFormat, this.currentChatId, useWebSearch);

      // Generate a unique ID for the assistant message
      const assistantMessageId = this.generateUniqueId();

      // Create bot message
      const botMessageElement = this.createMessageElement('assistant', response.content, response.format, this.currentChatId, assistantMessageId);
      chatHistory.appendChild(botMessageElement);

      // If web search was used and results are not empty, display them
      if (useWebSearch && response.webSearchResults && response.webSearchResults.length > 0) {
        const webSearchElement = this.createWebSearchElement(response.webSearchResults);
        chatHistory.appendChild(webSearchElement);
      }

      chatHistory.scrollTop = chatHistory.scrollHeight;

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      this.displayErrorMessage('An error occurred while sending the message. Please try again.');
      return false;
    } finally {
      this.hideTypingIndicator();
    }
  }

  initializeWebSearchToggle() {
    const webSearchToggle = document.getElementById('webSearchToggle');
    webSearchToggle.addEventListener('click', () => {
      webSearchToggle.classList.toggle('enabled');
      webSearchToggle.title = webSearchToggle.classList.contains('enabled') ? 'Web Search Enabled' : 'Enable Web Search';
    });
  }

  createWebSearchElement(results) {
    const webSearchDiv = document.createElement('div');
    webSearchDiv.classList.add('web-search-results');

    const heading = document.createElement('h4');
    heading.textContent = 'Web Search Results:';
    webSearchDiv.appendChild(heading);

    results = JSON.parse(results);
    results.forEach((result, index) => {
      const resultDiv = document.createElement('div');
      resultDiv.classList.add('search-result');

      const title = document.createElement('h5');
      title.textContent = result.title || 'No title';
      resultDiv.appendChild(title);

      const link = document.createElement('a');
      link.href = result.link || '#';
      link.textContent = result.link || 'No link';
      link.target = '_blank';
      resultDiv.appendChild(link);

      const summary = document.createElement('p');
      summary.textContent = result.summary || 'No summary available';
      resultDiv.appendChild(summary);

      const details = document.createElement('details');
      const summary2 = document.createElement('summary');
      summary2.textContent = 'More Details';
      details.appendChild(summary2);

      const detailsContent = document.createElement('div');
      detailsContent.innerHTML = `
        <p><strong>Date Published:</strong> ${result.datePublished || 'Not available'}</p>
        <p><strong>Domain:</strong> ${result.domainName || 'Not available'}</p>
        <p><strong>Main Content:</strong> ${(result.pageContent && result.pageContent.mainText) ? result.pageContent.mainText.substring(0, 200) + '...' : 'Not available'}</p>
        <p><strong>Key Headings:</strong> ${(result.pageContent && result.pageContent.headings) ? result.pageContent.headings.join(', ') : 'Not available'}</p>
        <p><strong>Number of Links:</strong> ${(result.pageContent && result.pageContent.links) ? result.pageContent.links : 'Not available'}</p>
        <p><strong>Number of Images:</strong> ${(result.pageContent && result.pageContent.images) ? result.pageContent.images : 'Not available'}</p>
      `;
      details.appendChild(detailsContent);

      resultDiv.appendChild(details);
      webSearchDiv.appendChild(resultDiv);
    });

    return webSearchDiv;
  }

  createMessageElement(role, content, format = 'text', chatId, messageId) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${role}-message`);
    messageDiv.dataset.chatId = chatId;
    messageDiv.dataset.id = messageId;
    messageDiv.dataset.format = format;
    messageDiv.dataset.originalContent = content;
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    
    console.log('Creating message element. Format:', format);
    console.log('Content:', content);

    switch (format) {
      case 'markdown':
        contentDiv.innerHTML = this.chatProcessor.processInput(content, 'markdown');
        this.applyCodeHighlighting(contentDiv);
        break;
      case 'code':
        contentDiv.innerHTML = this.processCodeContent(content);
        this.applyCodeHighlighting(contentDiv);
        break;
      case 'json':
        contentDiv.innerHTML = this.processJsonContent(content);
        contentDiv.classList.add('json-content');
        this.applyCodeHighlighting(contentDiv);
        break;
      default:
        contentDiv.innerHTML = this.chatProcessor.processInput(content, 'markdown');
        this.applyCodeHighlighting(contentDiv);
    }
    
    messageDiv.appendChild(contentDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('message-actions');

    const copyButton = document.createElement('button');
    copyButton.textContent = '📋';
    copyButton.onclick = () => this.copyMessage(content);
    actionsDiv.appendChild(copyButton);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '🗑️';
    deleteButton.onclick = () => this.deleteMessage(messageDiv);
    actionsDiv.appendChild(deleteButton);

    messageDiv.appendChild(actionsDiv);

    return messageDiv;
  }

  processCodeContent(content) {
    const lines = content.split('\n');
    let processedContent = '';
    let inCodeBlock = false;
    let codeBlockContent = '';
    let codeLanguage = '';

    lines.forEach(line => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          processedContent += `<pre><code class="language-${codeLanguage}">${this.escapeHtml(codeBlockContent.trim())}</code></pre>\n`;
          inCodeBlock = false;
          codeBlockContent = '';
          codeLanguage = '';
        } else {
          // Start of code block
          inCodeBlock = true;
          codeLanguage = this.getCodeLanguage(line);
        }
      } else if (inCodeBlock) {
        codeBlockContent += line + '\n';
      } else {
        // Process line as Markdown
        processedContent += this.chatProcessor.processInput(line, 'markdown') + '\n';
      }
    });

    // Close any open code block
    if (inCodeBlock) {
      processedContent += `<pre><code class="language-${codeLanguage}">${this.escapeHtml(codeBlockContent.trim())}</code></pre>\n`;
    }

    return processedContent;
  }

  getCodeLanguage(line) {
    const match = line.match(/```(\w+)?/);
    return match ? match[1] || 'plaintext' : 'plaintext';
  }

  applyCodeHighlighting(element) {
    element.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  copyMessage(content) {
    navigator.clipboard.writeText(content).then(() => {
      alert('Message copied to clipboard!');
    }, (err) => {
      console.error('Could not copy text: ', err);
    });
  }

  deleteMessage(messageElement) {
    if (confirm('Are you sure you want to delete this message?')) {
      messageElement.remove();
    }
  }

  showTypingIndicator() {
    document.getElementById('typing-indicator').classList.remove('hidden');
  }

  hideTypingIndicator() {
    document.getElementById('typing-indicator').classList.add('hidden');
  }

  displayErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.classList.add('error-message');
    errorDiv.textContent = message;
    
    const chatHistory = document.getElementById('chat-history');
    chatHistory.appendChild(errorDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  updateDeleteButton() {
    const event = new CustomEvent('updateDeleteButton');
    document.dispatchEvent(event);
  }

  processJsonContent(content) {
    try {
      const jsonObject = JSON.parse(content);
      const formattedJson = JSON.stringify(jsonObject, null, 2);
      return `<pre><code class="language-json">${this.escapeHtml(formattedJson)}</code></pre>`;
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return `<pre><code class="language-json">${this.escapeHtml(content)}</code></pre>`;
    }
  }

  async loadChatHistory(chatId) {
    try {
      this.loadingExistingChat = true;
      const messages = await window.api.getChatMessages(chatId);
      const chatHistory = document.getElementById('chat-history');
      chatHistory.innerHTML = '';

      messages.forEach(message => {
        const messageElement = this.createMessageElement(message.role, message.content, message.format || 'markdown', chatId, message.id);
        messageElement.dataset.saved = 'true'; // Mark as saved
        chatHistory.appendChild(messageElement);
      });

      chatHistory.scrollTop = chatHistory.scrollHeight;
      this.applyCodeHighlighting(chatHistory);
      this.setCurrentChatId(chatId);
    } catch (error) {
      console.error('Error loading chat history:', error);
      this.displayErrorMessage(`Error loading chat history: ${error.message}`);
    } finally {
      this.loadingExistingChat = false;
    }
  }

  setCurrentChatId(chatId) {
    this.currentChatId = chatId;
  }

  clearChatHistory() {
    const chatHistory = document.getElementById('chat-history');
    chatHistory.innerHTML = '';
  }

  generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}