import { ChatMarkdownProcessor } from './markdownConverter.js';
import { MessageHandler } from './message-handler.js';
import { UIHandler } from './ui-handler.js';
import { ChatHistoryManager } from './chat-history-manager.js';

document.addEventListener('DOMContentLoaded', () => {
  const chatProcessor = new ChatMarkdownProcessor();
  const messageHandler = new MessageHandler(chatProcessor);
  const chatHistoryManager = new ChatHistoryManager(messageHandler);
  const uiHandler = new UIHandler(messageHandler, chatHistoryManager);

  uiHandler.initializeEventListeners();
  chatHistoryManager.updateChatList();

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
});

console.log('Renderer script running');
console.log(window.api);