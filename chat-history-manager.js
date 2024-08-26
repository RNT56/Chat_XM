export class ChatHistoryManager {
  constructor(messageHandler, uiHandler) {
    this.messageHandler = messageHandler;
    this.uiHandler = uiHandler;
    this.currentChatId = null;
    this.deleteButton = null;
    this.initializeDeleteButton();
    this.initializeEventListeners();
  }

  createNewChat(model, outputFormat) {
    if (this.currentChatId) {
      this.saveChatHistory();
    }

    this.currentChatId = Date.now().toString();
    const chatHistory = document.getElementById('chat-history');
    chatHistory.innerHTML = '';
    document.getElementById('user-input').value = '';

    document.getElementById('model-select').value = model;
    document.getElementById('output-format').value = outputFormat;

    const newChatIndicator = document.createElement('div');
    newChatIndicator.textContent = `New chat started with model: ${model} and output format: ${outputFormat}`;
    newChatIndicator.classList.add('new-chat-indicator');
    chatHistory.appendChild(newChatIndicator);

    this.updateChatList();
  }

   saveChatHistory() {
    const chatHistory = document.getElementById('chat-history');
    const messages = Array.from(chatHistory.children)
      .filter(el => el.classList.contains('message'))
      .map(msg => {
        const contentElement = msg.querySelector('.message-content');
        return {
          role: msg.classList.contains('user-message') ? 'user' : 'bot',
          content: msg.dataset.originalContent || contentElement.textContent, // Use original content if available
          format: msg.dataset.format || 'text'
        };
      });

    if (messages.length === 0) return;

    const chatName = messages[0].content.substring(0, 30) + '...';
    const chatData = { 
      id: this.currentChatId, 
      name: chatName, 
      messages,
      model: document.getElementById('model-select').value,
      outputFormat: document.getElementById('output-format').value,
      timestamp: Date.now()
    };
    
    localStorage.setItem(`chat_${this.currentChatId}`, JSON.stringify(chatData));
  }

  loadChatHistory(chatId) {
    const chatData = JSON.parse(localStorage.getItem(`chat_${chatId}`));
    if (!chatData) return;

    this.currentChatId = chatId;
    const chatHistory = document.getElementById('chat-history');
    chatHistory.innerHTML = '';

    document.getElementById('model-select').value = chatData.model;
    document.getElementById('output-format').value = chatData.outputFormat;

    chatData.messages.forEach(msg => {
      const messageElement = this.messageHandler.createMessageElement(msg.role, msg.content, msg.format);
      chatHistory.appendChild(messageElement);
    });

    chatHistory.scrollTop = chatHistory.scrollHeight;
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

  updateChatList() {
    const chatList = document.getElementById('chat-list');
    chatList.innerHTML = '';

    const chats = Object.keys(localStorage)
      .filter(key => key.startsWith('chat_'))
      .map(key => JSON.parse(localStorage.getItem(key)))
      .sort((a, b) => b.timestamp - a.timestamp);

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
      }
    }
  }

  createChatListItem(chatData) {
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
    checkbox.onchange = (e) => {
      e.stopPropagation();
      this.updateDeleteButton();
    };
    
    listItem.appendChild(chatName);
    listItem.appendChild(checkbox);

    listItem.onclick = () => this.loadChatHistory(chatData.id);

    return listItem;
  }

  updateDeleteButton() {
    const checkedChats = document.querySelectorAll('#chat-list .chat-checkbox:checked');
    
    if (checkedChats.length > 0) {
      this.deleteButton.style.display = 'block';
    } else {
      this.deleteButton.style.display = 'none';
    }
  }

  deleteSelectedChats() {
    const checkedChats = document.querySelectorAll('#chat-list .chat-checkbox:checked');
    if (confirm(`Are you sure you want to delete ${checkedChats.length} chat(s)?`)) {
      let currentChatDeleted = false;
      checkedChats.forEach(checkbox => {
        const chatId = checkbox.closest('li').dataset.chatId;
        localStorage.removeItem(`chat_${chatId}`);
        if (this.currentChatId === chatId) {
          document.getElementById('chat-history').innerHTML = '';
          this.currentChatId = null;
          currentChatDeleted = true;
        }
      });
      this.updateChatList();
      if (currentChatDeleted) {
        this.selectMostRecentChat();
      }
    }
    this.updateDeleteButton();
  }

  selectMostRecentChat() {
    const chats = Object.keys(localStorage)
      .filter(key => key.startsWith('chat_'))
      .map(key => JSON.parse(localStorage.getItem(key)))
      .sort((a, b) => b.timestamp - a.timestamp);

    if (chats.length > 0) {
      this.loadChatHistory(chats[0].id);
    } else {
      this.createNewChat(document.getElementById('model-select').value, document.getElementById('output-format').value);
    }
  }

  editChatNameInline(chatNameElement, chatId) {
    const currentName = chatNameElement.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.classList.add('chat-name-input');

    const saveName = () => {
      const newName = input.value.trim();
      if (newName && newName !== currentName) {
        const chatData = JSON.parse(localStorage.getItem(`chat_${chatId}`));
        chatData.name = newName;
        localStorage.setItem(`chat_${chatId}`, JSON.stringify(chatData));
        chatNameElement.textContent = newName;
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

  deleteChat(chatId) {
    if (confirm('Are you sure you want to delete this chat?')) {
      localStorage.removeItem(`chat_${chatId}`);
      if (this.currentChatId === chatId) {
        this.createNewChat(document.getElementById('model-select').value, document.getElementById('output-format').value);
      }
      this.updateChatList();
    }
  }

  initializeDeleteButton() {
    this.deleteButton = document.createElement('button');
    this.deleteButton.id = 'delete-chats';
    this.deleteButton.textContent = 'Delete';
    this.deleteButton.onclick = () => this.deleteSelectedChats();
    this.deleteButton.style.display = 'none';
    document.querySelector('.sidebar-bottom-buttons').appendChild(this.deleteButton);
  }

  initializeEventListeners() {
    document.addEventListener('updateDeleteButton', () => {
      this.updateDeleteButton();
    });
  }
}