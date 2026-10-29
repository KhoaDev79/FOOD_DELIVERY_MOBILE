import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  message?: string;
  actionTitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  message,
  actionTitle,
  actionLabel,
  onAction,
  icon,
}) => {
  const desc = description || message;
  const btnTitle = actionTitle || actionLabel;

  return (
    <View style={styles.container}>
      {icon}
      <Text style={styles.title}>{title}</Text>
      {desc && <Text style={styles.description}>{desc}</Text>}
      {btnTitle && onAction && (
        <Button
          title={btnTitle}
          onPress={onAction}
          style={styles.button}
          size="small"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 16,
  },
});
