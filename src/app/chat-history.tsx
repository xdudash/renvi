import { Redirect, useLocalSearchParams } from 'expo-router';

// 45 · История сообщений — the conversation opened with older messages loading.
export default function ChatHistory() {
  const { match } = useLocalSearchParams<{ match: string }>();
  return <Redirect href={{ pathname: '/chat', params: { match, history: '1' } }} />;
}
