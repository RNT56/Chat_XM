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

    // Reset the current chat ID and set isNewChat to true
    this.setCurrentChatId(null);
    this.isNewChat = true;
    this.messageHandler.setCurrentChatId(null);

    // Update the model and output format
    document.getElementById('model-select').value = model;
    document.getElementById('output-format').value = outputFormat;
    console.log('Model and output format updated in UI');

    // Add a new chat indicator to the chat window
    const newChatIndicator = document.createElement('div');
    newChatIndicator.textContent = `New chat started with model: ${model} and output format: ${outputFormat}`;
    newChatIndicator.classList.add('new-chat-indicator');
    chatHistory.appendChild(newChatIndicator);
    console.log('New chat indicator added to chat window');

    // Update the chat list in the sidebar
    console.log('Updating chat list in sidebar');
    await this.updateChatList();
  }

  async saveChatHistory() {
    console.log('Saving chat history for chat:', this.currentChatId);
    if (!this.currentChatId) {
      console.log('No current chat ID, skipping save');
      return;
    }

    const chatHistory = document.getElementById('chat-history');
    const messages = Array.from(chatHistory.children)
      .filter(el => el.classList.contains('message'))
      .map(msg => {
        const contentElement = msg.querySelector('.message-content');
        return {
          role: msg.classList.contains('user-message') ? 'user' : 'assistant',
          content: msg.dataset.originalContent || contentElement.textContent,
          format: msg.dataset.format || 'text'
        };
      });

    console.log('Messages to save:', messages);

    if (messages.length === 0) {
      console.log('No messages to save, returning');
      return;
    }

    try {
      if (this.isNewChat) {
        // Create a new chat in Supabase
        const chatName = messages[0].content.substring(0, 30) + '...';
        console.log('Creating new chat:', chatName);
        const newChat = await window.api.createChat(chatName);
        this.setCurrentChatId(newChat.id);
        this.isNewChat = false;

        // Save all messages to Supabase
        for (const message of messages) {
          console.log('Saving new message:', message);
          await window.api.createChatMessage(this.currentChatId, message.role, message.content, message.format);
        }
      } else {
        // Update the chat name with the first message content
        const chatName = messages[0].content.substring(0, 30) + '...';
        console.log('Updating chat name:', chatName);
        await window.api.updateChat(this.currentChatId, chatName);

        // Get existing messages from Supabase
        const existingMessages = await window.api.getChatMessages(this.currentChatId);
        const existingMessageIds = new Set(existingMessages.map(m => m.id));

        // Save only new messages to Supabase
        for (const message of messages) {
          if (!existingMessageIds.has(message.id)) {
            console.log('Saving new message:', message);
            await window.api.createChatMessage(this.currentChatId, message.role, message.content, message.format);
          }
        }
      }
      console.log('All new messages saved successfully');
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
      this.setCurrentChatId(chatId);
      this.messageHandler.clearChatHistory();

      const chatHistory = document.getElementById('chat-history');
      chatHistory.innerHTML = ''; // Clear existing messages

      messages.forEach(msg => {
        const messageElement = this.messageHandler.createMessageElement(msg.role, msg.content, msg.format, chatId);
        chatHistory.appendChild(messageElement);
      });

      chatHistory.scrollTop = chatHistory.scrollHeight;
      console.log('Chat history loaded and displayed');
      this.updateChatList(); // Update to highlight the current chat
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
    chatList.innerHTML = '';

    try {
      const chats = await window.api.getAllChats();
      console.log('Retrieved chats:', chats);
      if (Array.isArray(chats)) {
        chats.forEach(chatData => {
          const listItem = this.createChatListItem(chatData);
          chatList.appendChild(listItem);
        });

        this.updateDeleteButton();

        // Highlight the current chat
        if (this.currentChatId) {
          const currentChatItem = chatList.querySelector(`li[data-chat-id="${this.currentChatId}"]`);
          if (currentChatItem) {
            currentChatItem.classList.add('active');
            console.log('Current chat highlighted:', this.currentChatId);
          }
        }
        console.log('Chat list updated');
      } else {
        throw new Error('Invalid response from server when fetching chats');
      }
    } catch (error) {
      console.error('Error updating chat list:', error);
      this.displayError('Failed to update chat list. Please refresh the page.');
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
}