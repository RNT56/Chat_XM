const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function initializeSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  console.log('Initializing Supabase client');
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key length:', supabaseKey ? supabaseKey.length : 'Not set');

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL and/or Anon Key are not set. Supabase functionality will be disabled.');
    console.warn('To enable Supabase, please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.');
    return null;
  }

  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client created successfully');
    return supabase;
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    return null;
  }
}

function getSupabase() {
  if (!supabase) {
    return initializeSupabase();
  }
  return supabase;
}

async function createChat(name) {
  console.log('Creating chat:', name);
  const supabase = getSupabase();
  if (!supabase) {
    console.error('Supabase client is not initialized');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('chats')
      .insert({ name })
      .select()
      .single();

    if (error) throw error;
    console.log('Chat created:', data);
    return data;
  } catch (error) {
    console.error('Error creating chat:', error);
    return null;
  }
}

async function getChat(id) {
  console.log('Getting chat:', id);
  const supabase = getSupabase();
  if (!supabase) {
    console.error('Supabase client is not initialized');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    console.log('Chat retrieved:', data);
    return data;
  } catch (error) {
    console.error('Error getting chat:', error);
    return null;
  }
}

async function updateChat(id, name) {
  console.log('Updating chat:', id, name);
  const supabase = getSupabase();
  if (!supabase) {
    console.error('Supabase client is not initialized');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('chats')
      .update({ name })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    console.log('Chat updated:', data);
    return data;
  } catch (error) {
    console.error('Error updating chat:', error);
    return null;
  }
}

async function deleteChat(id) {
  console.log('Deleting chat:', id);
  const supabase = getSupabase();
  if (!supabase) {
    console.error('Supabase client is not initialized');
    return false;
  }

  try {
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', id);

    if (error) throw error;
    console.log('Chat deleted:', id);
    return true;
  } catch (error) {
    console.error('Error deleting chat:', error);
    return false;
  }
}

async function getAllChats() {
  console.log('Getting all chats');
  const supabase = getSupabase();
  if (!supabase) {
    console.error('Supabase client is not initialized');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    console.log('Chats retrieved:', data.length);
    return data;
  } catch (error) {
    console.error('Error getting all chats:', error);
    return [];
  }
}

async function createChatMessage(chatId, role, content, format = 'text') {
  console.log('Creating chat message:', chatId, role, format);
  const supabase = getSupabase();
  if (!supabase) {
    console.error('Supabase client is not initialized');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ chat_id: chatId, role, content, format })
      .select()
      .single();

    if (error) throw error;
    console.log('Chat message created:', data);
    return data;
  } catch (error) {
    console.error('Error creating chat message:', error);
    return null;
  }
}

async function getChatMessages(chatId) {
  console.log('Getting chat messages:', chatId);
  const supabase = getSupabase();
  if (!supabase) {
    console.error('Supabase client is not initialized');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    console.log('Chat messages retrieved:', data.length);

    // Format messages in JSON
    const formattedMessages = data.map(message => ({
      id: message.id, // Include the message ID
      role: message.role,
      content: message.content,
      format: message.format
    }));

    return formattedMessages;
  } catch (error) {
    console.error('Error getting chat messages:', error);
    return [];
  }
}

async function deleteChatMessages(chatId) {
  console.log('Deleting chat messages:', chatId);
  const supabase = getSupabase();
  if (!supabase) {
    console.error('Supabase client is not initialized');
    return false;
  }

  try {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('chat_id', chatId);

    if (error) throw error;
    console.log('Chat messages deleted:', chatId);
    return true;
  } catch (error) {
    console.error('Error deleting chat messages:', error);
    return false;
  }
}

module.exports = {
  initializeSupabase,
  createChat,
  getChat,
  updateChat,
  deleteChat,
  getAllChats,
  createChatMessage,
  getChatMessages,
  deleteChatMessages
};