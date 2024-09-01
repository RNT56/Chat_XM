export class UIHandler {
  constructor(messageHandler, chatHistoryManager) {
    this.messageHandler = messageHandler;
    this.chatHistoryManager = chatHistoryManager;
    this.sendButton = document.getElementById('send-button');
    this.userInput = document.getElementById('user-input');
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