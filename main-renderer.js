import { ChatMarkdownProcessor } from './markdownConverter.js';
import { MessageHandler } from './message-handler.js';
import { UIHandler } from './ui-handler.js';
import { ChatHistoryManager } from './chat-history-manager.js';

function toggleTheme() {
    const body = document.body;
    const isDarkMode = body.classList.toggle('dark-mode');
    body.classList.toggle('light-mode', !isDarkMode);

    // Update the highlight.js theme
    document.getElementById('highlight-theme').href = isDarkMode 
        ? 'css/highlight.min.css'  // Dark theme
        : 'css/highlight.min1.css'; // Light theme

    localStorage.setItem('darkMode', isDarkMode);

    // Remove 'data-highlighted' attribute from all code blocks
    document.querySelectorAll('code[class*="language-"]').forEach(block => {
        block.removeAttribute('data-highlighted');
    });

    // Re-highlight all code blocks
    hljs.highlightAll();
}

function initializeTheme() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.body.classList.toggle('light-mode', !isDarkMode);

    // Set the initial highlight.js theme
    document.getElementById('highlight-theme').href = isDarkMode 
        ? 'css/highlight.min.css'  // Dark theme
        : 'css/highlight.min1.css'; // Light theme

    // Remove 'data-highlighted' attribute from all code blocks
    document.querySelectorAll('code[class*="language-"]').forEach(block => {
        block.removeAttribute('data-highlighted');
    });

    // Highlight all code blocks
    hljs.highlightAll();
}

document.addEventListener('DOMContentLoaded', () => {
    const chatProcessor = new ChatMarkdownProcessor();
    const messageHandler = new MessageHandler(chatProcessor);
    const chatHistoryManager = new ChatHistoryManager(messageHandler);
    const uiHandler = new UIHandler(messageHandler, chatHistoryManager);

    uiHandler.initializeEventListeners();
    chatHistoryManager.updateChatList();

    // Initialize theme
    initializeTheme();

    // Initialize with a new chat
    const defaultModel = document.getElementById('model-select').value;
    const defaultOutputFormat = document.getElementById('output-format').value;
    chatHistoryManager.createNewChat(defaultModel, defaultOutputFormat);

    // Add this observer to re-run syntax highlighting when chat content changes
    const chatContent = document.getElementById('chat-history');
    const observer = new MutationObserver(() => {
        hljs.highlightAll();
    });
    observer.observe(chatContent, { childList: true, subtree: true });

    // Add event listener for theme toggle button
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Make the window draggable
    const titlebar = document.getElementById('titlebar');
    titlebar.addEventListener('mousedown', (e) => {
        window.electron.send('drag-window');
    });

    // Add event listener for send button
    document.getElementById('send-button').addEventListener('click', async () => {
        const input = document.getElementById('user-input');
        const userMessage = input.value.trim();
        const model = document.getElementById('model-select').value; // Get selected model
        if (userMessage) {
            displayMessage('user', userMessage);

            try {
                const completion = await window.api.sendMessage([{ role: 'user', content: userMessage }], model);
                const aiMessage = completion.choices[0].message.content;
                displayMessage('assistant', aiMessage);
            } catch (error) {
                displayMessage('assistant', 'Sorry, something went wrong.');
            }

            input.value = '';
        }
    });

    function displayMessage(role, content) {
        const chatContainer = document.getElementById('chat-history');
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', role);
        messageElement.textContent = content;
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
});

console.log('Renderer script running');
console.log(window.api);