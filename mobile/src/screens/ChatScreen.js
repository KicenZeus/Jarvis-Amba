import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { mobileApi } from '../services/api';

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Halo! Saya Jarvis, asisten AI otonom Anda. Ada yang bisa saya bantu hari ini?',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef();

  const handleSend = async (textToSend = null) => {
    const message = textToSend || inputText;
    if (!message.trim() || loading) return;

    const userMsg = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text: message.trim(),
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await mobileApi.sendChatMessage(message.trim(), false);
      const assistantMsg = {
        id: 'reply_' + Date.now(),
        role: 'assistant',
        text: res.reply || 'Maaf, tidak ada respons yang dihasilkan.',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg = {
        id: 'err_' + Date.now(),
        role: 'system',
        text: `⚠️ Error: ${err.message}`,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: '💸 Catat Pengeluaran', fill: 'Beli ' },
    { label: '💰 Catat Pemasukan', fill: 'Dapat gaji ' },
    { label: '📊 Rekap Keuangan', prompt: 'Berapa total pengeluaranku minggu ini?' },
    { label: '🏆 Pengeluaran Terbesar', prompt: 'Tampilkan pengeluaran terbesar bulan ini' },
    { label: '📋 Agenda Hari Ini', prompt: 'Ringkasan agenda hari ini' },
    { label: '🎯 Tugas Prioritas', prompt: 'Apa saja tugas prioritas saya?' },
  ];

  const handleQuickAction = (action) => {
    if (action.fill) {
      setInputText(action.fill);
    } else if (action.prompt) {
      handleSend(action.prompt);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Quick Actions / Prompts Bar */}
      <View style={styles.quickBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickContent}>
          {quickActions.map((action, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={styles.quickChip}
              onPress={() => handleQuickAction(action)}
              disabled={loading}
            >
              <Text style={styles.quickText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Messages List */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const isSystem = m.role === 'system';
          return (
            <View
              key={m.id}
              style={[
                styles.messageRow,
                isUser ? styles.userRow : styles.assistantRow,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  isUser ? styles.userBubble : (isSystem ? styles.systemBubble : styles.assistantBubble),
                ]}
              >
                <Text style={styles.messageText}>{m.text}</Text>
                <Text style={styles.timeText}>{m.time}</Text>
              </View>
            </View>
          );
        })}
        {loading && (
          <View style={[styles.messageRow, styles.assistantRow]}>
            <View style={[styles.bubble, styles.assistantBubble, styles.loadingBubble]}>
              <ActivityIndicator size="small" color="#818cf8" />
              <Text style={styles.loadingText}>Jarvis sedang berpikir...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ketik pesan atau instruksi..."
          placeholderTextColor="#64748b"
          multiline
          maxLength={1000}
        />

        <TouchableOpacity 
          style={[styles.sendBtn, (!inputText.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!inputText.trim() || loading}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  quickBar: {
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingVertical: 8,
  },
  quickContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '500',
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: '#4f46e5',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#1e293b',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  systemBubble: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  messageText: {
    color: '#f8fafc',
    fontSize: 13,
    lineHeight: 19,
  },
  timeText: {
    fontSize: 9,
    color: '#94a3b8',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#030712',
    color: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  sendIcon: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

