import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and Anon Key must be provided');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function createChat(name) {
  const { data, error } = await supabase
    .from('chats')
    .insert({ name })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getChat(id) {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function updateChat(id, name) {
  const { data, error } = await supabase
    .from('chats')
    .update({ name })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteChat(id) {
  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getAllChats() {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createChatMessage(chatId, role, content, format = 'text') {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ chat_id: chatId, role, content, format })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getChatMessages(chatId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function deleteChatMessages(chatId) {
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('chat_id', chatId);

  if (error) throw error;
}