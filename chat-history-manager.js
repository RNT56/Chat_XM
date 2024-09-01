export class ChatHistoryManager {
  constructor(messageHandler, uiHandler) {
    this.messageHandler = messageHandler;
    this.uiHandler = uiHandler;
    this.currentChatId = null;
    this.isNewChat = true;
    this.deleteButton = null;
    this.checkedChats = new Set();
    this.initializeDeleteButton();
    this.initializeEventListeners();
    console.log('ChatHistoryManager initialized');
  }

  displayError(message) {
    console.error(message);
    if (this.uiHandler && typeof this.uiHandler.displayErrorMessage === 'function') {
      this.uiHandler.displayErrorMessage(message);
    }
  }

  async createNewChat(model, outputFormat) {
    console.log('Creating new chat:', { model, outputFormat });

    // If current chat is empty, update it instead of creating a new one
    if (this.currentChatId && this.isNewChat) {
      console.log('Updating existing empty chat:', this.currentChatId);
      await this.updateExistingChat(model, outputFormat);
      return;
    }

    // Save the complete previous chat to Supabase if it's not a new chat
    if (this.currentChatId && !this.isNewChat) {
      console.log('Saving previous chat:', this.currentChatId);
      await this.saveChatHistory();
    }

    // Clean the chat window
    const chatHistory = document.getElementById('chat-history');
    chatHistory.innerHTML = '';
    document.getElementById('user-input').value = '';
    console.log('Chat window cleaned');

    // Update the model and output format
    document.getElementById('model-select').value = model;
    document.getElementById('output-format').value = outputFormat;
    console.log('Model and output format updated in UI');

    // Create a new chat in Supabase
    const chatName = `New chat (${model})`;
    console.log('Creating new chat in Supabase:', chatName);
    try {
      const newChat = await window.api.createChat(chatName);
      this.setCurrentChatId(newChat.id);
      this.isNewChat = true;
      console.log('New chat created in Supabase:', newChat.id);

      // Add a new chat indicator to the chat window
      const newChatIndicator = document.createElement('div');
      newChatIndicator.textContent = `New chat started with model: ${model} and output format: ${outputFormat}`;
      newChatIndicator.classList.add('new-chat-indicator');
      chatHistory.appendChild(newChatIndicator);
      console.log('New chat indicator added to chat window');
    } catch (error) {
      console.error('Error creating new chat:', error);
      this.displayError('Failed to create new chat. Please try again.');
    }
  }

  async updateExistingChat(model, outputFormat) {
    try {
      await window.api.updateChat(this.currentChatId, `New chat (${model})`);
      document.getElementById('model-select').value = model;
      document.getElementById('output-format').value = outputFormat;
      console.log('Existing chat updated:', this.currentChatId);

      // Update the chat indicator
      const chatHistory = document.getElementById('chat-history');
      const newChatIndicator = chatHistory.querySelector('.new-chat-indicator');
      if (newChatIndicator) {
        newChatIndicator.textContent = `Chat updated with model: ${model} and output format: ${outputFormat}`;
      } else {
        const indicator = document.createElement('div');
        indicator.textContent = `Chat updated with model: ${model} and output format: ${outputFormat}`;
        indicator.classList.add('new-chat-indicator');
        chatHistory.appendChild(indicator);
      }
    } catch (error) {
      console.error('Error updating existing chat:', error);
      this.displayError('Failed to update chat. Please try again.');
    }
  }

  async saveChatHistory() {
    console.log('Saving chat history for chat:', this.currentChatId);
    if (!this.currentChatId) {
      console.log('No current chat ID, skipping save');
      return;
    }

    const chatHistory = document.getElementById('chat-history');
    const messages = Array.from(chatHistory.children)
      .filter(el => el.classList.contains('message') && !el.dataset.saved)
      .map(msg => ({
        id: msg.dataset.id,
        role: msg.classList.contains('user-message') ? 'user' : 'assistant',
        content: msg.dataset.originalContent || msg.querySelector('.message-content').textContent,
        format: msg.dataset.format || 'text'
      }));

    console.log('Messages to save:', messages);

    if (messages.length === 0) {
      console.log('No messages to save, returning');
      return;
    }

    try {
      // Update the chat name with the first message content
      const chatName = messages[0].content.substring(0, 30) + '...';
      console.log('Updating chat name:', chatName);
      await window.api.updateChat(this.currentChatId, chatName);

      // Get existing messages from Supabase
      const existingMessages = await window.api.getChatMessages(this.currentChatId);
      const existingMessageIds = new Set(existingMessages.map(m => m.id));

      // Save only new messages to Supabase
      for (const message of messages) {
        console.log('Saving new message:', message);
        await window.api.createChatMessage(this.currentChatId, message.role, message.content, message.format, message.id);
      }
      console.log('All new messages saved successfully');
      
      // Update the chat list after saving messages
      await this.updateChatList();
      
      this.isNewChat = false;
    } catch (error) {
      console.error('Error saving chat history:', error);
      this.displayError('Failed to save chat history. Some data may be lost.');
    }
  }

  async loadChatHistory(chatId) {
    console.log('Loading chat history for chat:', chatId);
    try {
      const messages = await window.api.getChatMessages(chatId);
      console.log('Retrieved messages:', messages);
      
      this.highlightCurrentChat();
      
      const chatHistory = document.getElementById('chat-history');
      chatHistory.innerHTML = ''; // Clear existing messages

      messages.forEach(msg => {
        const messageElement = this.messageHandler.createMessageElement(msg.role, msg.content, msg.format, chatId, msg.id);
        chatHistory.appendChild(messageElement);
      });

      chatHistory.scrollTop = chatHistory.scrollHeight;
      console.log('Chat history loaded and displayed');
      
      this.isNewChat = false;
    } catch (error) {
      console.error('Error loading chat history:', error);
      this.displayError('Failed to load chat history. Please try again.');
    }
  }

  addCheckboxToMessage(messageElement, chatId) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add('chat-checkbox');
    checkbox.dataset.chatId = chatId;

    checkbox.onchange = (e) => {
      e.stopPropagation();
      this.updateDeleteButton();
      if (!checkbox.checked) {
        checkbox.style.display = 'none';
      }
    };

    messageElement.appendChild(checkbox);

    messageElement.addEventListener('mouseenter', () => {
      checkbox.style.display = 'inline-block';
    });

    messageElement.addEventListener('mouseleave', () => {
      if (!checkbox.checked) {
        checkbox.style.display = 'none';
      }
    });
  }

  async updateChatList() {
    console.log('Updating chat list');
    const chatList = document.getElementById('chat-list');
    chatList.innerHTML = ''; // Clear existing items

    try {
      // Fetch the latest chats from the API
      const chats = await window.api.getAllChats();
      console.log('Retrieved chats:', chats);

      if (Array.isArray(chats)) {
        chats.forEach(chatData => {
          const listItem = this.createChatListItem(chatData);
          chatList.appendChild(listItem);
        });

        this.updateDeleteButton();
        this.highlightCurrentChat();

        console.log('Chat list updated');
      } else {
        throw new Error('Invalid response from server when fetching chats');
      }
    } catch (error) {
      console.error('Error updating chat list:', error);
      this.displayError('Failed to update chat list. Please refresh the page.');
    }
  }

  highlightCurrentChat() {
    if (this.currentChatId) {
      const currentChatItem = document.querySelector(`li[data-chat-id="${this.currentChatId}"]`);
      if (currentChatItem) {
        currentChatItem.classList.add('active');
        console.log('Current chat highlighted:', this.currentChatId);
      }
    }
  }

  createChatListItem(chatData) {
    console.log('Creating chat list item:', chatData);
    const listItem = document.createElement('li');
    listItem.dataset.chatId = chatData.id;

    const chatName = document.createElement('span');
    chatName.textContent = chatData.name;
    chatName.classList.add('chat-name');

    chatName.onclick = (e) => {
      e.stopPropagation();
      this.editChatNameInline(chatName, chatData.id);
    };

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add('chat-checkbox');
    checkbox.id = `chat-checkbox-${chatData.id}`; // Unique ID for each checkbox
    checkbox.checked = this.checkedChats.has(chatData.id);
    checkbox.onchange = (e) => {
      e.stopPropagation();
      if (checkbox.checked) {
        this.checkedChats.add(chatData.id);
      } else {
        this.checkedChats.delete(chatData.id);
      }
      this.updateDeleteButton();
    };

    listItem.appendChild(chatName);
    listItem.appendChild(checkbox);

    listItem.onclick = () => this.loadChatHistory(chatData.id);

    return listItem;
  }

  updateDeleteButton() {
    console.log('Checked chats:', this.checkedChats.size);

    if (this.checkedChats.size > 0) {
      this.deleteButton.style.display = 'block';
    } else {
      this.deleteButton.style.display = 'none';
    }
  }

  async deleteSelectedChats() {
    console.log('Deleting selected chats:', this.checkedChats.size);
    if (confirm(`Are you sure you want to delete ${this.checkedChats.size} chat(s)?`)) {
      let currentChatDeleted = false;
      for (const chatId of this.checkedChats) {
        try {
          console.log('Deleting chat:', chatId);
          await window.api.deleteChat(chatId);
          if (this.currentChatId === chatId) {
            document.getElementById('chat-history').innerHTML = '';
            this.setCurrentChatId(null);
            currentChatDeleted = true;
            console.log('Current chat deleted');
          }
        } catch (error) {
          console.error('Error deleting chat:', chatId, error);
          this.displayError(`Failed to delete chat ${chatId}. Please try again.`);
        }
      }
      this.checkedChats.clear();
      await this.updateChatList();
      if (currentChatDeleted) {
        await this.selectMostRecentChat();
      }
    }
    this.updateDeleteButton();
  }

  async selectMostRecentChat() {
    console.log('Selecting most recent chat');
    try {
      const chats = await window.api.getAllChats();
      console.log('Retrieved chats for selection:', chats);
      if (chats.length > 0) {
        await this.loadChatHistory(chats[0].id);
      } else {
        console.log('No existing chats, creating new chat');
        const currentModel = document.getElementById('model-select').value;
        const currentOutputFormat = document.getElementById('output-format').value;
        await this.createNewChat(currentModel, currentOutputFormat);
      }
    } catch (error) {
      console.error('Error selecting most recent chat:', error);
      this.displayError('Failed to select a chat. Please try again.');
    }
  }

  async editChatNameInline(chatNameElement, chatId) {
    console.log('Editing chat name inline:', chatId);
    const currentName = chatNameElement.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.classList.add('chat-name-input');

    const saveName = async () => {
      const newName = input.value.trim();
      if (newName && newName !== currentName) {
        try {
          console.log('Updating chat name:', chatId, newName);
          await window.api.updateChat(chatId, newName);
          chatNameElement.textContent = newName;
        } catch (error) {
          console.error('Error updating chat name:', error);
          chatNameElement.textContent = currentName;
          this.displayError('Failed to update chat name. Please try again.');
        }
      } else {
        chatNameElement.textContent = currentName;
      }
      chatNameElement.style.display = '';
      input.remove();
    };

    input.onblur = saveName;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveName();
      } else if (e.key === 'Escape') {
        chatNameElement.textContent = currentName;
        chatNameElement.style.display = '';
        input.remove();
      }
    };

    chatNameElement.style.display = 'none';
    chatNameElement.parentNode.insertBefore(input, chatNameElement);
    input.focus();
    input.select();
  }

  initializeDeleteButton() {
    this.deleteButton = document.createElement('button');
    this.deleteButton.id = 'delete-chats';
    this.deleteButton.textContent = 'Delete';
    this.deleteButton.onclick = () => this.deleteSelectedChats();
    this.deleteButton.style.display = 'none';
    document.querySelector('.sidebar-bottom-buttons').appendChild(this.deleteButton);
    console.log('Delete button initialized');
  }

  initializeEventListeners() {
    document.addEventListener('updateDeleteButton', () => {
      this.updateDeleteButton();
    });
    console.log('Event listeners initialized');
  }

  setCurrentChatId(chatId) {
    this.currentChatId = chatId;
    this.messageHandler.setCurrentChatId(chatId);
    this.updateChatList(); // Refresh the chat list to highlight the current chat
  }

  async sendMessage(model, userInput, outputFormat) {
    console.log('Sending message:', { model, userInput, outputFormat });

    const folderReferences = this.extractFolderReferences(userInput);
    if (folderReferences.length > 0) {
      const folderContents = await this.getFolderContents(folderReferences);
      // Append folder contents to the user input
      userInput += '\n\nContext from referenced folders:\n' + folderContents;
    }

    const chatHistory = document.getElementById('chat-history');
    const userMessage = this.messageHandler.createMessageElement('user', userInput, 'text', this.currentChatId);
    chatHistory.appendChild(userMessage);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    const assistantMessage = this.messageHandler.createMessageElement('assistant', '', 'text', this.currentChatId);
    chatHistory.appendChild(assistantMessage);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    try {
      const response = await window.api.sendMessage(model, userInput, outputFormat);
      console.log('Received response:', response);

      if (response.error) {
        throw new Error(response.error);
      }

      const { assistantReply, assistantReplyFormat } = response;
      this.messageHandler.updateMessageContent(assistantMessage, assistantReply, assistantReplyFormat);
      chatHistory.scrollTop = chatHistory.scrollHeight;

      // Save the assistant reply to Supabase
      await window.api.createChatMessage(this.currentChatId, 'assistant', assistantReply, assistantReplyFormat);
      console.log('Assistant reply saved to Supabase');
    } catch (error) {
      console.error('Error sending message:', error);
      this.displayError('Failed to send message. Please try again.');
    }
  }

  extractFolderReferences(input) {
    const regex = /@(\w+)/g;
    return (input.match(regex) || []).map(match => match.slice(1));
  }

  async getFolderContents(folderNames) {
    try {
      const contents = await window.api.getFolderContents(folderNames);
      return contents.map(item => `${item.folderName}: ${item.fileName}\n${item.content}`).join('\n\n');
    } catch (error) {
      console.error('Error getting folder contents:', error);
      this.displayError('Failed to retrieve folder contents. Some context might be missing.');
      return '';
    }
  }
}