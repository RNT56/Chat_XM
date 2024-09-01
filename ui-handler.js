export class UIHandler {
  constructor(messageHandler, chatHistoryManager) {
    this.messageHandler = messageHandler;
    this.chatHistoryManager = chatHistoryManager;
    this.sendButton = document.getElementById('send-button');
    this.userInput = document.getElementById('user-input');
    this.folderMode = false;
    this.foldersButton = document.getElementById('folders');
    this.newChatButton = document.getElementById('new-chat');
    this.sidebar = document.querySelector('.sidebar');
    this.folderList = document.getElementById('folder-list');

    this.foldersButton.addEventListener('click', () => this.toggleFolderMode());
  }

  initializeEventListeners() {
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.userInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendMessage();
      }
    });

    // Add input event listener to show/hide send button
    this.userInput.addEventListener('input', () => this.toggleSendButton());

    document.getElementById('new-chat').addEventListener('click', () => {
      const currentModel = document.getElementById('model-select').value;
      const currentOutputFormat = document.getElementById('output-format').value;
      this.chatHistoryManager.createNewChat(currentModel, currentOutputFormat);
    });

    document.getElementById('theme-toggle').addEventListener('click', this.toggleTheme);
    document.getElementById('toggle-sidebar').addEventListener('click', this.toggleSidebar);

    document.getElementById('model-select').addEventListener('change', (event) => {
      if (this.chatHistoryManager.isNewChat) {
        this.chatHistoryManager.updateExistingChat(event.target.value, document.getElementById('output-format').value);
      } else {
        this.chatHistoryManager.createNewChat(event.target.value, document.getElementById('output-format').value);
      }
    });

    document.getElementById('output-format').addEventListener('change', (event) => {
      if (this.chatHistoryManager.isNewChat) {
        this.chatHistoryManager.updateExistingChat(document.getElementById('model-select').value, event.target.value);
      } else {
        this.chatHistoryManager.createNewChat(document.getElementById('model-select').value, event.target.value);
      }
    });

    // Add event listeners for settings
    document.getElementById('settings-button').addEventListener('click', this.openSettings);
    document.getElementById('close-settings').addEventListener('click', this.closeSettings);
    document.getElementById('save-settings').addEventListener('click', this.saveSettings);
  }

  toggleSendButton() {
    if (this.userInput.value.trim() !== '') {
      this.sendButton.style.display = 'inline-block';
    } else {
      this.sendButton.style.display = 'none';
    }
  }

  async sendMessage() {
    const model = document.getElementById('model-select').value;
    const outputFormat = document.getElementById('output-format').value;
    const userInput = this.userInput.value.trim();

    if (userInput === '') return;

    const success = await this.messageHandler.sendMessage(model, userInput, outputFormat);
    if (success) {
      await this.chatHistoryManager.saveChatHistory();
      this.userInput.value = ''; // Clear the input field after sending
      this.toggleSendButton(); // Hide the send button after sending
    }
  }

  toggleTheme() {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    document.getElementById('theme-toggle').textContent = isDarkMode ? '🌙' : '☀️';
  }

  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const chatContainer = document.querySelector('.chat-container');
    sidebar.classList.toggle('collapsed');
    chatContainer.classList.toggle('expanded');
  }

  toggleFolderMode() {
    this.folderMode = !this.folderMode;
    this.sidebar.classList.toggle('folder-mode', this.folderMode);
    this.newChatButton.textContent = this.folderMode ? 'New Folder' : 'New Chat';
    this.foldersButton.textContent = this.folderMode ? 'Chats' : 'Folders';

    if (this.folderMode) {
      this.loadFolders();
    } else {
      this.chatHistoryManager.loadChatList();
    }
  }

  async loadFolders() {
    try {
      const folders = await window.api.getFolders();
      this.renderFolders(folders);
    } catch (error) {
      console.error('Error loading folders:', error);
      this.displayError('Failed to load folders. Please try again.');
    }
  }

  renderFolders(folders) {
    this.folderList.innerHTML = '';
    folders.forEach(folder => {
      const folderItem = this.createFolderListItem(folder);
      this.folderList.appendChild(folderItem);
    });
  }

  createFolderListItem(folderData) {
    const listItem = document.createElement('li');
    listItem.classList.add('folder-item');
    listItem.dataset.folderId = folderData.id;

    const folderName = document.createElement('span');
    folderName.textContent = folderData.name;
    folderName.classList.add('folder-name');

    const actionsContainer = document.createElement('div');
    actionsContainer.classList.add('folder-actions');

    const editButton = document.createElement('button');
    editButton.textContent = '✏️';
    editButton.onclick = (e) => {
      e.stopPropagation();
      this.editFolderName(folderData.id, folderName);
    };

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '🗑️';
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      this.deleteFolder(folderData.id);
    };

    actionsContainer.appendChild(editButton);
    actionsContainer.appendChild(deleteButton);

    listItem.appendChild(folderName);
    listItem.appendChild(actionsContainer);

    listItem.ondragover = (e) => this.handleDragOver(e);
    listItem.ondrop = (e) => this.handleDrop(e, folderData.id);

    return listItem;
  }

  async editFolderName(folderId, folderNameElement) {
    const newName = prompt('Enter new folder name:', folderNameElement.textContent);
    if (newName && newName !== folderNameElement.textContent) {
      try {
        await window.api.updateFolderName(folderId, newName);
        folderNameElement.textContent = newName;
      } catch (error) {
        console.error('Error updating folder name:', error);
        this.displayError('Failed to update folder name. Please try again.');
      }
    }
  }

  async deleteFolder(folderId) {
    if (confirm('Are you sure you want to delete this folder?')) {
      try {
        await window.api.deleteFolder(folderId);
        this.loadFolders();
      } catch (error) {
        console.error('Error deleting folder:', error);
        this.displayError('Failed to delete folder. Please try again.');
      }
    }
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  async handleDrop(e, folderId) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      try {
        await window.api.uploadFilesToFolder(folderId, files);
        this.displaySuccess('Files uploaded successfully.');
      } catch (error) {
        console.error('Error uploading files:', error);
        this.displayError('Failed to upload files. Please try again.');
      }
    }
  }

  openSettings = () => {
    document.getElementById('settings-modal').style.display = 'block';
    const apiKey = localStorage.getItem('api_key') || '';
    document.getElementById('api-key').value = apiKey;
  }

  closeSettings = () => {
    document.getElementById('settings-modal').style.display = 'none';
  }

  saveSettings = () => {
    const apiKey = document.getElementById('api-key').value.trim();
    localStorage.setItem('api_key', apiKey);
    this.closeSettings();
    // Here you would typically update the main process with the new API key
    window.api.updateApiKey(apiKey);
  }
}