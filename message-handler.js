export class MessageHandler {
  constructor(chatProcessor) {
    this.chatProcessor = chatProcessor;
  }

  async sendMessage(model, input, outputFormat) {
    const userInput = input.trim();
    if (userInput === '') return false;

    const chatHistory = document.getElementById('chat-history');
    const userMessage = this.createMessageElement('user', userInput, 'text');
    chatHistory.appendChild(userMessage);

    document.getElementById('user-input').value = '';

    this.showTypingIndicator();

    try {
      const response = await window.api.sendMessage(model, userInput, outputFormat);
      this.hideTypingIndicator();

      console.log('Received response:', response);
      console.log('Response format:', response.format);

      const botMessage = this.createMessageElement('bot', response.content, response.format);
      chatHistory.appendChild(botMessage);
      chatHistory.scrollTop = chatHistory.scrollHeight;

      return true;
    } catch (error) {
      console.error('Error communicating with OpenAI:', error);
      this.hideTypingIndicator();
      this.displayErrorMessage(`Error: ${error.message}`);
      return false;
    }
  }

  createMessageElement(role, content, format = 'text', chatId) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${role}-message`);
    messageDiv.dataset.format = format;
    messageDiv.dataset.originalContent = content;
    messageDiv.dataset.chatId = chatId;
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    
    console.log('Creating message element. Format:', format);
    console.log('Content:', content);

    if (format === 'markdown' || format === 'code' || format === 'json') {
      console.log(`Rendering ${format}`);
      try {
        let processedContent;
        if (format === 'code') {
          processedContent = this.processCodeContent(content);
        } else if (format === 'json') {
          processedContent = this.processJsonContent(content);
        } else {
          processedContent = this.chatProcessor.processInput(content, format);
        }
        console.log(`Processed ${format} content:`, processedContent);
        contentDiv.innerHTML = processedContent;
        if (format === 'json') {
          contentDiv.classList.add('json-content');
        } else {
          this.applyCodeHighlighting(contentDiv);
        }
      } catch (error) {
        console.error(`Error parsing ${format}:`, error);
        contentDiv.textContent = content;
      }
    } else {
      console.log('Displaying as plain text');
      contentDiv.textContent = content;
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
      return `<pre><code class="json-raw">${this.escapeHtml(formattedJson)}</code></pre>`;
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return `<pre><code class="json-raw">${this.escapeHtml(content)}</code></pre>`;
    }
  }
}