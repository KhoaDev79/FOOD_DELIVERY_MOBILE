import React from 'react';
import { View } from 'react-native';
import { inlineSegments } from '../../../utils/helpQuality';
import { Text } from '../../ui';

/**
 * Nội dung bài Trợ giúp dạng văn bản có cấu trúc đơn giản:
 * "## " tiêu đề lớn, "### " tiêu đề nhỏ, "- " gạch đầu dòng, "1. " danh sách số, dòng trống = khoảng cách.
 * "**chữ**" in đậm, "*chữ*" in nghiêng.
 * Dùng chung cho màn đọc bài của khách và phần "Xem trước" khi admin soạn bài.
 */

const Inline: React.FC<{ text: string }> = ({ text }) => (
  <>
    {inlineSegments(text).map((seg, i) =>
      seg.bold ? (
        <Text key={i} variant="body" weight="bold">
          {seg.text}
        </Text>
      ) : seg.italic ? (
        <Text key={i} variant="body" className="italic">
          {seg.text}
        </Text>
      ) : (
        seg.text
      ),
    )}
  </>
);
export const ArticleBody: React.FC<{ body: string }> = ({ body }) => (
  <>
    {body.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <View key={idx} className="h-2" />;

      if (trimmed.startsWith('### ')) {
        return (
          <Text key={idx} variant="title" weight="bold" className="mb-1 mt-3 text-ink">
            {trimmed.slice(4).replace(/\*\*/g, '')}
          </Text>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <Text key={idx} variant="headline" weight="bold" className="mb-1.5 mt-4 text-ink">
            {trimmed.slice(3).replace(/\*\*/g, '')}
          </Text>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <View key={idx} className="my-0.5 flex-row items-start gap-2 pl-1">
            <View className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-500" />
            <Text variant="body" tone="default" className="flex-1 leading-relaxed">
              <Inline text={trimmed.slice(2)} />
            </Text>
          </View>
        );
      }
      const numbered = trimmed.match(/^(\d+\.)\s(.*)/);
      if (numbered) {
        return (
          <View key={idx} className="my-0.5 flex-row items-start gap-2 pl-1">
            <Text variant="body" weight="bold" tone="brand">
              {numbered[1]}
            </Text>
            <Text variant="body" tone="default" className="flex-1 leading-relaxed">
              <Inline text={numbered[2]} />
            </Text>
          </View>
        );
      }
      return (
        <Text key={idx} variant="body" tone="default" className="my-1 leading-relaxed text-ink/90">
          <Inline text={trimmed} />
        </Text>
      );
    })}
  </>
);
