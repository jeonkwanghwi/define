/**
 * TextField — 디자인 토큰이 적용된 텍스트 입력 (single-line / multiline).
 *
 * design-source의 .field 스타일에 매핑:
 *   - 안쪽 표면(surface-nested) 배경, 1.5px 라인 보더, 라운드 md
 *   - 포커스 시 보더가 포인트 색으로 변하고 살짝 글로우(둘러싼 면) 효과
 *   - placeholder 색은 자동(ink.placeholder)
 *
 * multiline=true일 때 Android에서 텍스트가 위쪽 정렬되도록 textAlignVertical 적용.
 *
 * 사용:
 *   <TextField value={v} onChangeText={setV} placeholder="단어를 입력하세요" />
 *   <TextField multiline value={v} onChangeText={setV} style={{ minHeight: 150 }} />
 */
import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

export type TextFieldProps = TextInputProps;

/**
 * `forwardRef`로 외부에서 ref(autoFocus 등)에 접근 가능.
 * 예: 시트 슬라이드업 후 inputRef.current?.focus()로 자연스러운 포커스 등장.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { style, multiline, onFocus, onBlur, ...rest },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      ref={ref}
      multiline={multiline}
      placeholderTextColor={theme.colors.ink.placeholder}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        styles.base,
        theme.typography.body,
        {
          color: theme.colors.ink.primary,
          backgroundColor: theme.colors.surface.nested,
          borderColor: focused ? theme.colors.point.p500 : theme.colors.line.base,
          borderRadius: theme.radii.md,
        },
        // multiline일 때만 좀 더 큰 기본 높이 + 안드로이드 상단 정렬
        multiline && { minHeight: 100, textAlignVertical: 'top' },
        style,
      ]}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});
