import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LORA_RADIO_CONSTRAINTS } from '../config/network';
import { validateMessagePayload } from '../domain/message';

interface MessageComposerProps {
  onSend: (text: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
}

export function MessageComposer({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
}: MessageComposerProps) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const byteLength = new TextEncoder().encode(text).length;
  const maxBytes = LORA_RADIO_CONSTRAINTS.maxPayloadBytes;
  const isOverLimit = byteLength > maxBytes;

  const handleSend = async () => {
    if (disabled || isSending || !text.trim() || isOverLimit) return;

    const validation = validateMessagePayload(text, maxBytes);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Message exceeds radio limit');
      return;
    }

    setErrorMsg(null);
    setIsSending(true);
    try {
      await onSend(text.trim());
      setText('');
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.composerWrapper}>
      {errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (errorMsg) setErrorMsg(null);
          }}
          style={[styles.input, isOverLimit && styles.inputOverLimit]}
          placeholder={placeholder}
          placeholderTextColor="#82919B"
          multiline
          maxLength={maxBytes}
          editable={!disabled && !isSending}
        />
        <Pressable
          onPress={handleSend}
          disabled={!text.trim() || isOverLimit || disabled || isSending}
          style={[
            styles.sendButton,
            (!text.trim() || isOverLimit || disabled || isSending) && styles.disabled,
          ]}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.byteRow}>
        <Text style={styles.byteText}>
          {byteLength > 0 ? `${byteLength}/${maxBytes} bytes (LoRa SX1278)` : 'LoRa 433 MHz'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composerWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E7ECEF',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 9,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#F2F5F6',
    color: '#24343C',
    fontSize: 14,
  },
  inputOverLimit: {
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#167D6A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 19,
  },
  byteRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  byteText: {
    color: '#95A1A7',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 11,
    textAlign: 'center',
  },
});
